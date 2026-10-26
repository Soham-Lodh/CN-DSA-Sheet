import { prisma } from "@/lib/prisma";
import { Difficulty, SyncStatus, VerificationStatus, SyncLog } from "@prisma/client";
import { getProvider } from "@/lib/platform/registry";
import { sortLockKeys, syncLockKey, withStrictLocking } from "@/lib/locking";

const MIN_SYNC_INTERVAL_MINUTES = parseInt(
  process.env.PLATFORM_SYNC_MIN_INTERVAL_MINUTES || "10",
  10
);
/** RUNNING logs older than this are considered crashed and may be superseded. */
const STALE_SYNC_RUNNING_MS = 30 * 60_000;

/**
 * Batch size for solved-problem persistence. Upserts are flushed to the
 * database in chunks so one giant loop never holds a connection for minutes
 * (the pooler + interactive-transaction timeout previously killed LeetCode
 * syncs with "Transaction API error: Transaction not found").
 */
const UPSERT_BATCH_SIZE = 40;

export interface SyncResult {
  status: SyncStatus;
  recordsProcessed: number;
  error?: string;
  cached?: boolean;
}

/**
 * Claim-based per-user sync serialization.
 *
 * A durable `RUNNING` SyncLog row created inside a short transaction that
 * holds the canonical `sync:<userId>` advisory claim lock acts as the mutex:
 * it survives across pooled connections, works on multiple server instances,
 * and never spans the external LeetCode calls. A concurrent sync sees the
 * RUNNING claim (fresh within STALE_SYNC_RUNNING_MS) and reports `cached`,
 * instead of racing duplicate provider fetches. All writes remain idempotent
 * upserts, so even unclaimable races cannot corrupt data.
 */
async function claimSync(userId: string, force: boolean): Promise<{ claimed: boolean; existingClaim?: SyncLog }> {
  const now = new Date();
  return withStrictLocking(
    { lockKeys: [syncLockKey(userId)], idempotent: true },
    async (tx) => {
      // Rate-limit repeated syncs unless forced (re-check inside the claim).
      const account = await tx.platformAccount.findUnique({ where: { userId } });
      if (!account) return { claimed: false };
      if (!force && account.lastSuccessfulSyncAt) {
        const elapsedMinutes = (now.getTime() - account.lastSuccessfulSyncAt.getTime()) / (1000 * 60);
        if (elapsedMinutes < MIN_SYNC_INTERVAL_MINUTES) return { claimed: false };
      }
      const running = await tx.syncLog.findFirst({
        where: { userId, status: SyncStatus.RUNNING },
        orderBy: { startedAt: "desc" },
      });
      if (
        running &&
        now.getTime() - running.startedAt.getTime() < STALE_SYNC_RUNNING_MS
      ) {
        return { claimed: false, existingClaim: running };
      }
      await closeStaleRunningLogs(tx, userId);
      const syncLog = await tx.syncLog.create({
        data: { userId, status: SyncStatus.RUNNING, startedAt: now },
      });
      return { claimed: true, existingClaim: syncLog };
    },
    prisma
  );
}

/** Close stale RUNNING sync logs (crashed/restarted runs) so logs stay truthful. */
async function closeStaleRunningLogs(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string) {
  try {
    await tx.syncLog.updateMany({
      where: {
        userId,
        status: SyncStatus.RUNNING,
        startedAt: { lt: new Date(Date.now() - STALE_SYNC_RUNNING_MS) },
      },
      data: {
        status: SyncStatus.FAILED,
        errorMessage: "Superseded by a newer sync (previous run did not finish).",
      },
    });
  } catch {
    // Cosmetic cleanup only - never block the real sync.
  }
}

export async function syncUserPlatformAccount(
  userId: string,
  force = false
): Promise<SyncResult> {
  const claim = await claimSync(userId, force);
  if (!claim.claimed || !claim.existingClaim) {
    // Either already syncing recently, or no platform account connected.
    const hasAccount = await prisma.platformAccount.findUnique({ where: { userId }, select: { id: true } });
    if (!hasAccount) {
      return {
        status: SyncStatus.FAILED,
        recordsProcessed: 0,
        error: "LeetCode account not connected",
      };
    }
    return { status: SyncStatus.SUCCESS, recordsProcessed: 0, cached: true };
  }
  const syncLog = claim.existingClaim;
  const now = new Date();

  try {
    const account = await prisma.platformAccount.findUnique({ where: { userId } });
    if (!account) {
      return { status: SyncStatus.FAILED, recordsProcessed: 0, error: "LeetCode account not connected" };
    }
    const provider = getProvider();

    // Fetch stats, recent solved problems and profile concurrently.
    const [stats, solvedProblems, profile] = await Promise.all([
      provider.fetchStats(account.username),
      provider.fetchSolvedProblems(account.username),
      provider.fetchProfile(account.username).catch(() => null),
    ]);

    // Persistence is deliberately NOT one big interactive transaction: every
    // write is idempotent, so a partial sync is safely resumable by the next
    // sync instead of rolling back everything (and no DB locks are held
    // across external HTTP calls).
    const snapshotData = {
      totalSolved: stats.totalSolved,
      easySolved: stats.easySolved,
      mediumSolved: stats.mediumSolved,
      hardSolved: stats.hardSolved,
      rating: stats.rating ?? profile?.rating,
      rank: stats.rank ?? profile?.rank,
      rawMetadata: stats.rawMetadata || {},
    };
    await prisma.platformSnapshot.upsert({
      where: { userId },
      create: { userId, fetchedAt: now, ...snapshotData },
      update: { fetchedAt: now, ...snapshotData },
    });

    for (let i = 0; i < solvedProblems.length; i += UPSERT_BATCH_SIZE) {
      const batch = solvedProblems.slice(i, i + UPSERT_BATCH_SIZE);
      await Promise.all(
        batch.map((sp: { externalKey: string; title?: string; difficulty?: Difficulty; solvedAt?: Date; sourceSubmissionId?: string; source?: string }) =>
          prisma.solvedProblem.upsert({
            where: { userId_externalKey: { userId, externalKey: sp.externalKey } },
            create: {
              userId,
              externalKey: sp.externalKey,
              title: sp.title,
              difficulty: sp.difficulty,
              solvedAt: sp.solvedAt,
              sourceSubmissionId: sp.sourceSubmissionId,
              source: sp.source,
              firstSeenAt: now,
              lastSeenAt: now,
            },
            update: {
              title: sp.title,
              difficulty: sp.difficulty,
              lastSeenAt: now,
              // Never move solvedAt backwards on re-syncs.
              solvedAt: sp.solvedAt ?? undefined,
            },
          })
        )
      );
    }

    await prisma.platformAccount.update({
      where: { id: account.id },
      data: {
        lastSyncedAt: now,
        lastSuccessfulSyncAt: now,
        lastError: null,
        verificationStatus:
          account.verificationStatus === VerificationStatus.PENDING
            ? VerificationStatus.VERIFIED
            : account.verificationStatus,
      },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.SUCCESS,
        completedAt: new Date(),
        recordsProcessed: solvedProblems.length,
      },
    });

    return { status: SyncStatus.SUCCESS, recordsProcessed: solvedProblems.length };
  } catch (err: unknown) {
    const errorMessage = (err instanceof Error ? err.message : "Unknown synchronization error").slice(0, 1000);
    console.error(`Sync error for user ${userId}:`, errorMessage);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { status: SyncStatus.FAILED, completedAt: new Date(), errorMessage },
    }).catch(() => {});

    await prisma.platformAccount.updateMany({
      where: { userId },
      data: { lastSyncedAt: now, lastError: errorMessage },
    }).catch(() => {});

    return { status: SyncStatus.FAILED, recordsProcessed: 0, error: errorMessage };
  }
}

export async function syncAllUserAccounts(userId: string, force = false): Promise<SyncResult[]> {
  return [await syncUserPlatformAccount(userId, force)];
}

export async function syncAllAccountsCron(): Promise<{ total: number; succeeded: number; failed: number }> {
  const accounts = await prisma.platformAccount.findMany({
    where: { verificationStatus: { in: [VerificationStatus.VERIFIED, VerificationStatus.PENDING] } },
    take: 100,
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
  });

  let succeeded = 0;
  let failed = 0;
  for (const acc of accounts) {
    const res = await syncUserPlatformAccount(acc.userId, false);
    if (res.status === SyncStatus.SUCCESS) succeeded++;
    else failed++;
  }

  return { total: accounts.length, succeeded, failed };
}

export { sortLockKeys };
