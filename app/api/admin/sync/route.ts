import { NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { syncAllAccountsCron } from "@/lib/services/sync-engine";

export async function POST() {
  try {
    await requireAdmin();

    const result = await syncAllAccountsCron();

    return NextResponse.json({
      success: true,
      message: `Synchronized ${result.succeeded}/${result.total} accounts (${result.failed} failed).`,
      result,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
