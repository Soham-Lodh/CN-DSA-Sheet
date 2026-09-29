import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSheetLeaderboard } from "@/lib/services/leaderboard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const sheet = await prisma.sheet.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    }

    const leaderboard = await getSheetLeaderboard(sheet.id);

    return NextResponse.json({
      sheet,
      leaderboard,
    });
  } catch (error: any) {
    console.error("Sheet leaderboard error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sheet leaderboard" },
      { status: 500 }
    );
  }
}
