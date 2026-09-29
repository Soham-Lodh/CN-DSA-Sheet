import { NextResponse } from "next/server";
import { getCurrentProfile, handleAuthError } from "@/lib/auth";
import { syncUserPlatformAccount } from "@/lib/services/sync-engine";

export async function POST() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncUserPlatformAccount(profile.id, true);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return handleAuthError(error);
  }
}
