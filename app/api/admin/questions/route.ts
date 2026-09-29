import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createQuestionSchema } from "@/lib/validations";
import { parseProblemUrl } from "@/lib/platform/url-parser";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get("sheetId");

    const questions = await prisma.sheetQuestion.findMany({
      where: sheetId ? { sheetId } : undefined,
      orderBy: { position: "asc" },
      include: {
        sheet: { select: { id: true, name: true, slug: true } },
        question: true,
      },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const validated = createQuestionSchema.parse(body);

    const parsed = parseProblemUrl(validated.url);

    // Idempotent upserts on unique keys - no transaction needed.
    const question = await prisma.question.upsert({
      where: { externalKey: parsed.externalKey },
      create: {
        externalKey: parsed.externalKey,
        title: validated.title,
        url: parsed.normalizedUrl,
        difficulty: validated.difficulty,
        topic: validated.topic,
        tags: validated.tags,
        createdById: admin.id,
      },
      update: {
        title: validated.title,
        url: parsed.normalizedUrl,
        difficulty: validated.difficulty,
        topic: validated.topic,
        tags: validated.tags,
      },
    });

    let position = validated.position;
    if (position === undefined) {
      const lastSq = await prisma.sheetQuestion.findFirst({
        where: { sheetId: validated.sheetId },
        orderBy: { position: "desc" },
      });
      position = (lastSq?.position ?? 0) + 1;
    }

    const sheetQuestion = await prisma.sheetQuestion.upsert({
      where: {
        sheetId_questionId: {
          sheetId: validated.sheetId,
          questionId: question.id,
        },
      },
      create: { sheetId: validated.sheetId, questionId: question.id, position },
      update: { position },
      include: { question: true, sheet: true },
    });

    return NextResponse.json({ sheetQuestion }, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
