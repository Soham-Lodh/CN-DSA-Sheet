import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations";
import { getUserGlobalRank } from "@/lib/services/leaderboard";
import { getAllSheetsWithUserProgress } from "@/lib/services/sheets";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [platformAccount, snapshot, achievements, globalRank, sheetProgress] =
      await Promise.all([
        prisma.platformAccount.findUnique({ where: { userId: profile.id } }),
        prisma.platformSnapshot.findUnique({ where: { userId: profile.id } }),
        prisma.userAchievement.findMany({
          where: { userId: profile.id },
          include: { achievement: true },
        }),
        getUserGlobalRank(profile.id),
        getAllSheetsWithUserProgress(profile.id),
      ]);

    return NextResponse.json({
      profile,
      globalRank,
      totalSolved: snapshot?.totalSolved ?? 0,
      platformAccount,
      snapshot,
      achievements,
      sheetProgress,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateProfileSchema.parse(body);

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        name: validated.name || undefined,
        rollNumber: validated.rollNumber !== undefined ? validated.rollNumber : undefined,
        avatarUrl: validated.avatarUrl !== undefined ? validated.avatarUrl : undefined,
      },
    });

    return NextResponse.json({ profile: updated });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
