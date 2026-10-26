import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { LockTimeoutError } from "@/lib/locking";
import {
  IdempotencyConflictError,
  IdempotencyTakeoverError,
} from "@/lib/idempotency";
import { randomUUID } from "crypto";

/**
 * Standardized API error envelopes (see docs/implementation-audit.md, A10).
 *
 * Browser responses never contain stack traces, raw Prisma errors, SQL, or
 * provider details. Internal detail goes to server logs only, tagged with a
 * request id that is echoed back for support.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
  };
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly userMessage: string,
    readonly retryable = false
  ) {
    super(userMessage);
    this.name = "ApiError";
  }

  static unauthorized(): ApiError {
    return AUTH_REQUIRED();
  }

  static forbidden(): ApiError {
    return FORBIDDEN();
  }

  static notFound(what?: string): ApiError {
    return NOT_FOUND(what === undefined ? undefined : what as string);
  }
}

export const AUTH_REQUIRED = () => new ApiError("UNAUTHORIZED", 401, "You need to sign in first.");
export const FORBIDDEN = () => new ApiError("FORBIDDEN", 403, "Admin access required.");
export const NOT_FOUND = (what: string | undefined = "Resource") =>
  new ApiError("NOT_FOUND", 404, `${what} not found.`);
export const BAD_REQUEST = (message: string) => new ApiError("BAD_REQUEST", 400, message);
export const RATE_LIMITED = (ms?: number) =>
  new ApiError("RATE_LIMITED", 429, ms ? `Slow down and try again in ${ms}s.` : "Slow down and try again shortly.", true);

/** Safe Prisma error → ApiError mapping. Never leaks SQL or internals. */
export function fromPrismaError(error: Prisma.PrismaClientKnownRequestError): ApiError | null {
  switch (error.code) {
    case "P2002":
      return new ApiError("CONFLICT", 409, "That record already exists.", false);
    case "P2025":
      return new ApiError("NOT_FOUND", 404, "Record not found.", false);
    case "P2003":
      return new ApiError("CONFLICT", 409, "Related record is missing or still referenced.", false);
    case "P2024":
      return new ApiError("DB_TIMEOUT", 503, "The database is busy. Try again shortly.", true);
    default:
      return null;
  }
}

interface ErrorEnvelope {
  body: ApiErrorBody["error"];
  status: number;
  internalDetail: string;
}

function mapError(error: unknown): ErrorEnvelope {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { code: error.code, message: error.userMessage, retryable: error.retryable, requestId: randomUUID() },
      internalDetail: `[api] ${error.code}: ${error.message}`,
    };
  }
  if (error instanceof LockTimeoutError) {
    return {
      status: 503,
      body: { code: error.code, message: "Too much contention right now. Try again in a moment.", retryable: true, requestId: randomUUID() },
      internalDetail: `[api] DB_LOCK_TIMEOUT: ${error.message}`,
    };
  }
  if (error instanceof IdempotencyConflictError) {
    return {
      status: 409,
      body: { code: error.code, message: "This action was already submitted with different data. Refresh and repeat it if needed.", retryable: false, requestId: randomUUID() },
      internalDetail: `[api] ${error.code}: ${error.message}`,
    };
  }
  if (error instanceof IdempotencyTakeoverError) {
    return {
      status: 429,
      body: { code: error.code, message: "Still processing your earlier request — retrying with the same action is safe.", retryable: true, requestId: randomUUID() },
      internalDetail: `[api] ${error.code}: ${error.message}`,
    };
  }
  if (error instanceof ZodError) {
    const first = error.issues?.[0]?.message || "Invalid request payload";
    return {
      status: 400,
      body: { code: "VALIDATION", message: first, retryable: false, requestId: randomUUID() },
      internalDetail: `[api] VALIDATION: ${error.message}`,
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = fromPrismaError(error);
    if (mapped) {
      return {
        status: mapped.status,
        body: { code: mapped.code, message: mapped.userMessage, retryable: mapped.retryable, requestId: randomUUID() },
        internalDetail: `[api] Prisma ${error.code}: ${error.message}`,
      };
    }
  }
  if (error instanceof SyntaxError) {
    return {
      status: 400,
      body: { code: "MALFORMED_JSON", message: "Request body is not valid JSON.", retryable: false, requestId: randomUUID() },
      internalDetail: "[api] MALFORMED_JSON body",
    };
  }
  return {
    status: 500,
    body: { code: "INTERNAL", message: "Something went wrong on our side. Please try again.", retryable: true, requestId: randomUUID() },
    internalDetail: `[api] INTERNAL: ${error instanceof Error ? error.stack : String(error)}`,
  };
}

/**
 * Wraps a route handler so failures always produce the standard envelope and
 * internal errors are logged (with id) but never serialized to the client.
 */
export function withApiErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const mapped = mapError(error);
      if (mapped.status >= 500) {
        console.error(`${mapped.internalDetail} (requestId=${mapped.body.requestId})`);
      } else {
        console.warn(`${mapped.internalDetail} (requestId=${mapped.body.requestId})`);
      }
      return NextResponse.json({ error: mapped.body }, { status: mapped.status });
    }
  };
}

/** Legacy simple handler kept for auth-only routes. */
export function handleAuthError(error: unknown): NextResponse {
  const wrapper = withApiErrors(async () => { throw error; });
  return wrapper() as unknown as NextResponse;
}

/** Records a completed write's Cache-Control so private data never edge-caches. */
export function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "private, no-store" };
}
