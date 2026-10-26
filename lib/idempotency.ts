import { prisma } from "@/lib/prisma";
import { TxClient } from "@/lib/locking";

/**
 * Durable idempotency ledger (see docs/implementation-audit.md, A4).
 *
 * A side-effecting request supplies an `Idempotency-Key`. The first execution
 * records (user, route, key, fingerprint, result) atomically with the state
 * change itself. A replay of the same key+payload returns the recorded result
 * without re-applying the change; reusing the key with a different payload is
 * a controlled conflict. Concurrency for the same key is arbitrated by the
 * unique constraint on (userId, route, key) plus lock ordering done by the
 * caller's transaction — the database, not a process-local Map, is the
 * authority.
 */

export const IDEMPOTENCY_IDLE_MS = 30_000; // takeover window for crashed claims

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_CONFLICT";
  constructor() {
    super("This idempotency key was already used with a different request payload");
  }
}

export class IdempotencyTakeoverError extends Error {
  readonly code = "IDEMPOTENCY_IN_FLIGHT";
  constructor() {
    super("An identical request with this key is still being processed");
  }
}

/** Deterministic fingerprint of the validated payload (key order independent). */
export function fingerprintPayload(payload: unknown): string {
  return stableStringify(payload);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export interface ClaimOutcome {
  /** The mutation must run; the claim was created/taken over in this tx. */
  kind: "EXECUTE";
  id: string;
  /** A previous completed execution exists; replay its recorded result. */
  kindReplay?: never;
  recordedResult?: unknown;
}

export type IdempotencyClaim =
  | { kind: "EXECUTE"; id: string }
  | { kind: "REPLAY"; recordedResult: unknown };

/**
 * Claims the idempotency key inside the caller's transaction (which must
 * already hold the mutation's locks in canonical order). Raises typed errors
 * for payload conflicts and in-flight concurrent claims.
 */
export async function claimIdempotencyKey(
  tx: TxClient,
  params: { userId: string; route: string; key: string; fingerprint: string }
): Promise<IdempotencyClaim> {
  const { userId, route, key, fingerprint } = params;

  try {
    const created = await tx.idempotencyRecord.create({
      data: { userId, route, key, fingerprint, state: "PENDING" },
      select: { id: true },
    });
    return { kind: "EXECUTE", id: created.id };
  } catch (error) {
    // P2002 = unique violation: someone already holds this key.
    if ((error as { code?: string })?.code !== "P2002") throw error;
  }

  const existing = await tx.idempotencyRecord.findUnique({
    where: { userId_route_key: { userId, route, key } },
    select: { id: true, fingerprint: true, state: true, result: true, createdAt: true },
  });
  if (!existing) {
    // Raced delete (retention cleanup); retryable by caller.
    throw new IdempotencyTakeoverError();
  }

  if (existing.fingerprint !== fingerprint) {
    throw new IdempotencyConflictError();
  }

  if (existing.state === "COMPLETED") {
    return { kind: "REPLAY", recordedResult: existing.result };
  }

  // PENDING: a concurrent identical request holds the mutation locks right
  // now, or a previous run crashed mid-way. Take over only after the idle
  // window; otherwise ask the client to retry with the same key.
  const age = Date.now() - existing.createdAt.getTime();
  if (age < IDEMPOTENCY_IDLE_MS) {
    throw new IdempotencyTakeoverError();
  }
  await tx.idempotencyRecord.update({
    where: { id: existing.id },
    data: { createdAt: new Date(), result: undefined },
  });
  return { kind: "EXECUTE", id: existing.id };
}

/**
 * Marks the claim completed with the recorded result. Called in the SAME
 * transaction as the state change so both commit atomically.
 */
export async function completeIdempotencyClaim(
  tx: TxClient,
  id: string,
  result: unknown
) {
  await tx.idempotencyRecord.update({
    where: { id },
    data: { state: "COMPLETED", completedAt: new Date(), result: result as object },
  });
}

/** Retention cleanup: drop records older than the supported retry window. Safe to re-run. */
export async function pruneIdempotencyRecords(retentionDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const removed = await prisma.idempotencyRecord.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return removed.count;
}
