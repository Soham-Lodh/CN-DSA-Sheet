import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Supabase's transaction pooler (PgBouncer/Supavisor) occasionally drops idle
 * connections, which surfaces as a one-off P1001 "Can't reach database server"
 * (observed as random 500s on the first request after an idle period). These
 * are connection-class errors: the query never executed, so retrying is safe.
 * Non-connection errors (constraint violations, etc.) are never retried.
 */
const RETRYABLE_ERROR_CODES = new Set(["P1001", "P1002", "P1017", "P2024"]);

async function withConnectionRetry<T>(fn: () => Promise<T>, attemptsLeft = 2): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const code = (error as Prisma.PrismaClientKnownRequestError)?.code;
    if (attemptsLeft > 1 && typeof code === "string" && RETRYABLE_ERROR_CODES.has(code)) {
      console.warn(
        `[prisma] transient connection error (${code}) - retrying once after 750ms`
      );
      await new Promise((resolve) => setTimeout(resolve, 750));
      return withConnectionRetry(fn, attemptsLeft - 1);
    }
    throw error;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // Retries every model operation / raw query transparently on transient
  // connection failures - no call-site changes needed anywhere in the app.
  const extended = base.$extends({
    query: {
      $allOperations({ args, query }) {
        return withConnectionRetry(() => query(args));
      },
    },
  });

  // The extended client is structurally compatible for our usage; cast keeps
  // the exported type identical to the previous PrismaClient export.
  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
