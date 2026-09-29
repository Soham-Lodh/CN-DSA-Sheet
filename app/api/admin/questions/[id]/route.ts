import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateQuestionSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const validated = updateQuestionSchema.parse(body);

    const sheetQuestion = await prisma.sheetQuestion.findUnique({
      where: { id },
      include: { question: true },
    });

    if (!sheetQuestion) {
      return NextResponse.json({ error: "Sheet question not found" }, { status: 404 });
    }

    if (validated.position !== undefined) {
      await prisma.sheetQuestion.update({
        where: { id },
        data: { position: validated.position },
      });
    }

    const question = await prisma.question.update({
      where: { id: sheetQuestion.questionId },
      data: {
        title: validated.title || undefined,
        topic: validated.topic || undefined,
        tags: validated.tags || undefined,
        difficulty: validated.difficulty || undefined,
      },
    });

    return NextResponse.json({ sheetQuestion: { ...sheetQuestion, question } });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await prisma.sheetQuestion.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
