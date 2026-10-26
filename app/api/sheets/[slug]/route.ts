import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getSheetWithUserProgress } from "@/lib/services/sheets";
import { withApiErrors } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiErrors(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> => {
    const { slug } = await params;
    const profile = await getCurrentProfile().catch(() => null);

    const sheetData = await getSheetWithUserProgress(slug, profile?.id);
    if (!sheetData) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Sheet not found.", retryable: false, requestId: "" } },
        { status: 404 }
      );
    }

    // Private (contains the caller's personal progress) responses are never
    // edge-cached; anonymous catalogue views can be briefly shared.
    const cacheControl = profile ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300";
    return NextResponse.json(sheetData, { headers: { "Cache-Control": cacheControl } });
  }
);
