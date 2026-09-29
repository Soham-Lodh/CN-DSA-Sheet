import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { parseProblemUrl } from "@/lib/platform/url-parser";
import { getProvider } from "@/lib/platform/registry";
import { parseUrlSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const validated = parseUrlSchema.parse(body);

    const parsed = parseProblemUrl(validated.url);
    const metadata = await getProvider().fetchProblemMetadata(parsed.externalKey);

    return NextResponse.json({
      externalKey: parsed.externalKey,
      normalizedUrl: parsed.normalizedUrl,
      title: metadata?.title || `Problem ${parsed.rawSlug}`,
      difficulty: metadata?.difficulty || "UNKNOWN",
      topic: metadata?.topic || "General",
      tags: metadata?.tags || [],
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to parse problem URL" },
      { status: 400 }
    );
  }
}
