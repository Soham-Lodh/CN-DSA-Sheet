import { NextResponse } from "next/server";
import { getGlobalLeaderboard } from "@/lib/services/leaderboard";

export async function GET() {
  try {
    const leaderboard = await getGlobalLeaderboard();
    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    console.error("Global leaderboard error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch global leaderboard" },
      { status: 500 }
    );
  }
}
