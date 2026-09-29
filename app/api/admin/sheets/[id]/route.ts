import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSheetSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const validated = updateSheetSchema.parse(body);

    const sheet = await prisma.sheet.update({
      where: { id },
      data: {
        name: validated.name || undefined,
        slug: validated.slug || undefined,
        description: validated.description !== undefined ? validated.description : undefined,
        status: validated.status || undefined,
        easyPoints: validated.easyPoints ?? undefined,
        mediumPoints: validated.mediumPoints ?? undefined,
        hardPoints: validated.hardPoints ?? undefined,
      },
    });

    return NextResponse.json({ sheet });
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

    await prisma.sheet.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
