import { NextResponse } from "next/server";
import { getGlobalLeaderboard } from "@/lib/services/leaderboard";
import { withApiErrors } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (): Promise<NextResponse> => {
  const leaderboard = await getGlobalLeaderboard();
  // Shared computed read: safe to cache briefly at the edge (no personal data
  // beyond what the public page already shows).
  return NextResponse.json(
    { leaderboard },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
  );
});
