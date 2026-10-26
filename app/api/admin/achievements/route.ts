import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAuthError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const achievementSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_-]+$/),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  threshold: z.number().int().nonnegative(),
  icon: z.string().trim().max(16).optional().nullable(),
});

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ achievements: await prisma.achievement.findMany({ orderBy: { threshold: "asc" } }) });
  } catch (error) { return handleAuthError(error); }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const input = achievementSchema.parse(await request.json());
    const achievement = await prisma.achievement.create({ data: input });
    return NextResponse.json({ achievement }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") return NextResponse.json({ error: error.issues }, { status: 400 });
    if (error?.code === "P2002") return NextResponse.json({ error: "Achievement key already exists" }, { status: 409 });
    return handleAuthError(error);
  }
}
