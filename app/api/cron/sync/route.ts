import { NextRequest, NextResponse } from "next/server";
import { syncAllAccountsCron } from "@/lib/services/sync-engine";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If not configured, block by default for safety
    return false;
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader === `Bearer ${secret}`) {
    return true;
  }

  const urlSecret = request.nextUrl.searchParams.get("secret");
  if (urlSecret && urlSecret === secret) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized: Invalid CRON_SECRET" }, { status: 401 });
  }

  try {
    const summary = await syncAllAccountsCron();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (error: any) {
    console.error("Cron sync error:", error);
    return NextResponse.json({ error: error.message || "Cron sync failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
