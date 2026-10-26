import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSheetSchema } from "@/lib/validations";
import { invalidateTags, sheetCatalogueInvalidationTags } from "@/lib/cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const validated = updateSheetSchema.parse(body);

    // Resolve before update because slugs may change (old tag must drop too).
    const before = await prisma.sheet.findUnique({ where: { id }, select: { slug: true } });

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

    // Post-commit: both old and new slug views are refreshed.
    const tags = new Set<string>(await sheetCatalogueInvalidationTags(sheet.slug));
    if (before?.slug && before.slug !== sheet.slug) tags.add(`sheet:${before.slug}`);
    await invalidateTags([...tags]);

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

    const sheet = await prisma.sheet.findUnique({ where: { id }, select: { slug: true } });
    if (!sheet) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Sheet not found.", retryable: false, requestId: "" } }, { status: 404 });
    }

    await prisma.sheet.delete({ where: { id } });

    // Post-commit: catalogue/sitemap/per-sheet views must not keep serving it.
    await invalidateTags(await sheetCatalogueInvalidationTags(sheet.slug));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
