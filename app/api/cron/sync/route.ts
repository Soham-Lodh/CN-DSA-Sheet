import { NextRequest, NextResponse } from "next/server";
import { syncAllAccountsCron } from "@/lib/services/sync-engine";
import { withApiErrors } from "@/lib/api-errors";
import { pruneIdempotencyRecords } from "@/lib/idempotency";
import { timingSafeEqual } from "crypto";

/**
 * Verifies the cron secret in constant time on both the Authorization
 * header and `?secret=` query paths. Never reveals which one failed.
 */
function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If not configured, block by default for safety.
    return false;
  }

  const provided =
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("secret") ??
    "";

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiErrors(async (request: NextRequest): Promise<NextResponse> => {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized.", retryable: false, requestId: "" } },
      { status: 401 }
    );
  }

  const summary = await syncAllAccountsCron();
  // Bounded retention cleanup piggybacks on the scheduled run — never deletes
  // records still inside the supported retry window (7 days).
  try {
    const pruned = await pruneIdempotencyRecords(7);
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), summary, idempotencyPruned: pruned });
  } catch {
    // Cleanup is best-effort; the sync summary is still valid.
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), summary });
  }
});

/** GET kept for schedulers that issue GET requests. */
export function GET(request: NextRequest) {
  return POST(request);
}
