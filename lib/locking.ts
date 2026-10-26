import { Prisma } from "@prisma/client";

/**
 * Interactive transaction runner shape of the (extended) PrismaClient.
 */
export interface TransactionRunner {
  $transaction: <U>(
    fn: (tx: Prisma.TransactionClient) => Promise<U>,
    opts?: { timeout?: number; maxWait?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
  ) => Promise<U>;
}

/**
 * Strict two-phase locking (2PL) for multi-row mutations, on PostgreSQL
 * transaction-scoped advisory locks.
 *
 * Contract (see docs/implementation-audit.md, item A5):
 *  1. A mutation declares every resource it locks as a stable lock key
 *     (e.g. `user:<id>`, `question:<id>`).
 *  2. All keys are known before the transaction starts. They are sorted into
 *     one global deterministic order, so two mutations can never acquire the
 *     same resources in opposite orders (the classic AB/BA deadlock).
 *  3. The growing phase acquires ALL locks before any write. The shrinking
 *     phase is empty: locks are never released early, they are released by
 *     PostgreSQL only when the transaction commits or rolls back (strict 2PL).
 *  4. Advisory locks are hashed to signed 64-bit integers. A hash collision
 *     merely serializes two unrelated mutations briefly; it never weakens
 *     correctness because correctness still rests on unique constraints and
 *     conditional writes.
 *  5. Waiters cannot hang: lock_timeout / statement_timeout are set
 *     transaction-locally, and deadlocks (P2034) are retried a bounded number
 *     of times with jitter, only when the caller declares the operation
 *     idempotent-safe for re-execution within a fresh transaction.
 *
 * NOTE on Supabase transaction pooler compatibility: we intentionally use
 * transaction-scoped advisory locks (pg_advisory_xact_lock), never session-
 * level locks, because sessions do not survive PgBouncer transaction pooling.
 */

export type TxClient = Prisma.TransactionClient;

/** Retriable serialization conflicts: prisma P2034 wraps deadlock/serialization. */
export class LockTimeoutError extends Error {
  readonly code = "DB_LOCK_TIMEOUT";
  constructor() {
    super("Could not acquire the required record locks within the configured timeout");
  }
}

function boundedInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), max);
}

/** Conservative upper bounds so a bad env value can never hang requests. */
export const LOCK_TIMEOUT_MS = boundedInt(
  process.env.DB_LOCK_TIMEOUT_MS,
  5_000,
  30_000
);
export const STATEMENT_TIMEOUT_MS = boundedInt(
  process.env.DB_STATEMENT_TIMEOUT_MS,
  15_000,
  60_000
);
export const TRANSACTION_TIMEOUT_MS = boundedInt(
  process.env.DB_TRANSACTION_TIMEOUT_MS,
  20_000,
  60_000
);

/**
 * FNV-1a 64-bit hash of an arbitrary lock key, mapped into PostgreSQL's
 * signed 64-bit integer range. Stable across processes and restarts.
 */
export function advisoryLockBigInt(key: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < key.length; i++) {
    hash ^= BigInt(key.charCodeAt(i));
    hash = (hash * prime) & 0xfffffffffffffffn; // keep in 56-bit scratch
  }
  // Spread 56 bits → 64 and force into signed range.
  const unsigned = hash & 0x0000ffffffffffffn;
  const signed = BigInt.asIntN(63, unsigned * 256n);
  return signed;
}

/**
 * Canonical ordering for lock keys. Same input set → same acquisition order
 * everywhere in the codebase. Types are compared first so that keys of
 * different resource types interleave predictably, then keys lexically.
 */
export function sortLockKeys(keys: readonly string[]): string[] {
  return [...keys].sort((a, b) => {
    const [typeA] = splitKey(a);
    const [typeB] = splitKey(b);
    if (typeA !== typeB) return typeA < typeB ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function splitKey(key: string): [string, string] {
  const idx = key.indexOf(":");
  return idx === -1 ? [key, key] : [key.slice(0, idx), key.slice(idx + 1)];
}

export function userLockKey(userId: string): string {
  return `user:${userId}`;
}
export function questionLockKey(questionId: string): string {
  return `question:${questionId}`;
}
export function sheetLockKey(sheetId: string): string {
  return `sheet:${sheetId}`;
}
export function syncLockKey(userId: string): string {
  return `sync:${userId}`;
}

/** Applies transaction-local PostgreSQL timeouts (must run inside a tx). */
async function applyTimeouts(tx: TxClient, lockMs: number, stmtMs: number) {
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = ${Math.max(0, Math.floor(lockMs))}`);
  await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${Math.max(0, Math.floor(stmtMs))}`);
  await tx.$executeRawUnsafe(`SET LOCAL idle_in_transaction_session_timeout = ${Math.max(0, Math.floor(stmtMs))}`);
}

/**
 * Acquires the given transaction-scoped advisory locks in canonical order
 * (strict-2PL growing phase). MUST be called before any write of the
 * transaction, and the locks are held until commit/rollback.
 */
export async function acquireAdvisoryLocks(tx: TxClient, keys: readonly string[]) {
  const ordered = sortLockKeys(keys);
  for (const key of ordered) {
    const hashed = advisoryLockBigInt(key);
    // Raises lock_timeout on contention; never blocks indefinitely.
    // pg_advisory_xact_lock() returns void, which Prisma $queryRaw cannot
    // deserialize ("Failed to deserialize column of type 'void'"); selecting
    // a scalar FROM the lock function yields a deserializable result set.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${hashed}::bigint)`;
  }
  return ordered;
}

const RETRYABLE_TX_CODES = new Set(["P2034"]);

export interface StrictLockingOptions {
  /** Stable resource keys locked by this mutation (sorted deterministically). */
  lockKeys: readonly string[];
  /**
   * True when re-running the callback inside a fresh transaction cannot
   * duplicate effects (idempotent writes / upserts). Only then are
   * deadlock/serialization failures retried.
   */
  idempotent?: boolean;
  maxRetries?: number;
}

/**
 * Runs `callback` inside one transaction per attempt, acquiring all declared
 * locks in canonical order BEFORE the callback runs and holding them until
 * commit — the strict-2PL discipline. Serialization conflicts/deadlocks are
 * retried on a whole fresh transaction, bounded, with jitter.
 */
export async function withStrictLocking<T>(
  options: StrictLockingOptions,
  callback: (tx: TxClient) => Promise<T>,
  prismaClient: TransactionRunner
): Promise<T> {
  const maxRetries = Math.min(options.maxRetries ?? 2, 5);
  const lockMs = LOCK_TIMEOUT_MS;
  const stmtMs = STATEMENT_TIMEOUT_MS;

  let attempt = 0;
  // Bounded loop: attempt 0 + maxRetries.
  for (;;) {
    try {
      return await prismaClient.$transaction(
        async (tx) => {
          await applyTimeouts(tx, lockMs, stmtMs);
          await acquireAdvisoryLocks(tx, options.lockKeys);
          // Growing phase complete — all writes below run while holding every
          // declared lock; PostgreSQL releases them at commit (strict 2PL).
          return callback(tx);
        },
        {
          timeout: TRANSACTION_TIMEOUT_MS,
          maxWait: 5_000,
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        }
      );
    } catch (error) {
      if (options.idempotent && attempt < maxRetries) {
        const code = (error as Prisma.PrismaClientKnownRequestError)?.code;
        if (typeof code === "string" && RETRYABLE_TX_CODES.has(code)) {
          attempt += 1;
          const jitter = Math.floor(Math.random() * 120);
          await new Promise((resolve) => setTimeout(resolve, attempt * 150 + jitter));
          continue;
        }
      }
      // Inside the tx, lock timeout surfaces as a raw PostgreSQL error
      // (statement canceling due to statement timeout) — normalize it.
      const msg = error instanceof Error ? error.message : String(error);
      if (/lock timeout|canceling statement due to statement timeout/i.test(msg)) {
        throw new LockTimeoutError();
      }
      throw error;
    }
  }
}
