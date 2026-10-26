import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { syncUserPlatformAccount } from "@/lib/services/sync-engine";
import { invalidateTags, syncInvalidationTags } from "@/lib/cache";
import { withApiErrors, noStoreHeaders, ApiError } from "@/lib/api-errors";
import { SyncStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiErrors(async (): Promise<NextResponse> => {
  const profile = await getCurrentProfile().catch(() => null);
  if (!profile) {
    throw ApiError.unauthorized();
  }

  const result = await syncUserPlatformAccount(profile.id, true);
  // Derive per-user/sheet view tags that changed and drop them post-commit
  // (sync writes already committed at this point).
  await invalidateTags(await syncInvalidationTags(profile.id));

  // Never forward provider/internal error text to the browser.
  const safeResult =
    result.status === SyncStatus.FAILED
      ? { status: result.status, recordsProcessed: 0, error: "Sync failed. Try again later." }
      : result;

  return NextResponse.json(
    { success: result.status === SyncStatus.SUCCESS, result: safeResult },
    { headers: noStoreHeaders() }
  );
});
