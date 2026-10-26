import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPlatformAccountSchema } from "@/lib/validations";
import { invalidateTags, syncInvalidationTags } from "@/lib/cache";

export async function GET() {
  try {
    await requireAdmin();

    const accounts = await prisma.platformAccount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            rollNumber: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const validated = verifyPlatformAccountSchema.parse(body);

    const account = await prisma.platformAccount.update({
      where: { id: validated.accountId },
      data: {
        verificationStatus: validated.status,
      },
    });

    // Verification flag feeds leaderboard/profile views for that user.
    await invalidateTags(await syncInvalidationTags(account.userId));

    return NextResponse.json({ account });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
