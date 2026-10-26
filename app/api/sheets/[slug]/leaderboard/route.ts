import { NextRequest, NextResponse } from "next/server";
import { getSheetLeaderboard } from "@/lib/services/leaderboard";
import { prisma } from "@/lib/prisma";
import { withApiErrors, noStoreHeaders } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiErrors(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> => {
    const { slug } = await params;

    const sheet = await prisma.sheet.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Sheet not found.", retryable: false, requestId: "" } },
        { status: 404 }
      );
    }

    const leaderboard = await getSheetLeaderboard(sheet.id);

    // Shared (non-personal) computed read: briefly cacheable at the edge.
    return NextResponse.json(
      { sheet, leaderboard },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  }
);
