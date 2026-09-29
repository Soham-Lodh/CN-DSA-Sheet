import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getAllSheetsWithUserProgress } from "@/lib/services/sheets";

export async function GET() {
  try {
    const profile = await getCurrentProfile().catch(() => null);
    const sheets = await getAllSheetsWithUserProgress(profile?.id);

    return NextResponse.json({ sheets });
  } catch (error: any) {
    console.error("Sheets fetch error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch sheets" }, { status: 500 });
  }
}
