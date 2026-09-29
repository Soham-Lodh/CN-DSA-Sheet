import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSheetSchema } from "@/lib/validations";

export async function GET() {
  try {
    await requireAdmin();

    const sheets = await prisma.sheet.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sheetQuestions: true } } },
    });

    return NextResponse.json({ sheets });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const validated = createSheetSchema.parse(body);

    const existing = await prisma.sheet.findUnique({ where: { slug: validated.slug } });
    if (existing) {
      return NextResponse.json(
        { error: "A sheet with this slug already exists" },
        { status: 409 }
      );
    }

    const sheet = await prisma.sheet.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description,
        status: validated.status,
        easyPoints: validated.easyPoints,
        mediumPoints: validated.mediumPoints,
        hardPoints: validated.hardPoints,
        createdById: admin.id,
      },
    });

    return NextResponse.json({ sheet }, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
