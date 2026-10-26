import { PrismaClient, Prisma } from "@prisma/client";
import { LOCK_TIMEOUT_MS, STATEMENT_TIMEOUT_MS, TRANSACTION_TIMEOUT_MS } from "@/lib/locking";

export { LOCK_TIMEOUT_MS, STATEMENT_TIMEOUT_MS, TRANSACTION_TIMEOUT_MS };

/**
 * PrismaClient singleton for Supabase PostgreSQL.
 *
 * Retry policy (see docs/implementation-audit.md, A6):
 * - Only connection-family errors that mean "the query never started"
 *   (P1001/P1002 unreachable, P2024 pool timeout) are candidates for retry.
 * - Retries apply ONLY to reference-only operations (findUnique/findMany/
 *   count/aggregate/groupBy/queryRaw variants). Mutations (create/update/upsert/
 *   delete/connect...) are NEVER retried here: whether a write committed is
 *   ambiguous, and duplicate writes are prevented by idempotency keys +
 *   unique constraints at the call sites instead.
 * - Backoff is exponential with jitter, bounded to 3 attempts.
 * - Deadlock/serialization (P2034) inside transactions is handled by
 *   lib/locking.ts withStrictLocking(), not here.
 */

const CONNECTION_ERROR_CODES = new Set(["P1001", "P1002", "P2024"]);

const READ_ONLY_ACTIONS = /^(findUnique|findFirst|findFirstOrThrow|findUniqueOrThrow|findMany|count|aggregate|groupBy|queryRaw|queryRawUnsafe)$/;

type LoggableError = Partial<Prisma.PrismaClientKnownRequestError> & { message?: string };

function classify(error: unknown): "CONNECTION_READ" | "OTHER" {
  const err = error as LoggableError;
  if (err && typeof err.code === "string" && CONNECTION_ERROR_CODES.has(err.code)) {
    // $allOperations hands us the action name in `error.message` only for
    // some error shapes; the action filter below comes from the extension.
    return "CONNECTION_READ";
  }
  return "OTHER";
}

async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: boolean,
  attemptsLeft = 3
): Promise<T> {
  if (!isRetryable) return fn();
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attemptsLeft - 1 || classify(error) !== "CONNECTION_READ") {
        throw error;
      }
      attempt += 1;
      const backoff = 300 * 2 ** (attempt - 1) + Math.floor(Math.random() * 150);
      console.warn(`[prisma] transient connection error - retry ${attempt} in ${backoff}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  const extended = base.$extends({
    query: {
      $allOperations({ operation, args, query }) {
        // Only read-only statements may transparently retry on "never
        // started" connection errors; writes and transactions never do.
        return withRetry(() => query(args), READ_ONLY_ACTIONS.test(operation));
      },
    },
  });

  // Structurally compatible for our usage; keeps the exported PrismaClient type.
  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
