import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getAllSheetsWithUserProgress } from "@/lib/services/sheets";
import { withApiErrors } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (): Promise<NextResponse> => {
  const profile = await getCurrentProfile().catch(() => null);
  const sheets = await getAllSheetsWithUserProgress(profile?.id);

  // Personalized (solved counts) when signed in → private; anonymous → shared.
  const cacheControl = profile ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300";
  return NextResponse.json({ sheets }, { headers: { "Cache-Control": cacheControl } });
});
