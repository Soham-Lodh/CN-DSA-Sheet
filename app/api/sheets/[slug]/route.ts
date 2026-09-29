import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getSheetWithUserProgress } from "@/lib/services/sheets";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const profile = await getCurrentProfile().catch(() => null);

    const sheetData = await getSheetWithUserProgress(slug, profile?.id);
    if (!sheetData) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    }

    return NextResponse.json(sheetData);
  } catch (error: any) {
    console.error("Sheet fetch error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch sheet" }, { status: 500 });
  }
}
