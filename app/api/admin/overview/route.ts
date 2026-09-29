import { NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SheetStatus, SyncStatus } from "@prisma/client";

export async function GET() {
  try {
    await requireAdmin();

    const [
      totalUsers,
      totalSheets,
      publishedSheets,
      totalQuestions,
      totalSolvedRecords,
      leetcodeAccounts,
      recentSyncLogs,
      recentFailedSyncs,
    ] = await Promise.all([
      prisma.profile.count(),
      prisma.sheet.count(),
      prisma.sheet.count({ where: { status: SheetStatus.PUBLISHED } }),
      prisma.question.count(),
      prisma.solvedProblem.count(),
      prisma.platformAccount.count(),
      prisma.syncLog.findMany({
        take: 10,
        orderBy: { startedAt: "desc" },
        include: {
          user: { select: { name: true, email: true, rollNumber: true } },
        },
      }),
      prisma.syncLog.count({ where: { status: SyncStatus.FAILED } }),
    ]);

    return NextResponse.json({
      metrics: {
        totalUsers,
        totalSheets,
        publishedSheets,
        totalQuestions,
        totalSolvedRecords,
        leetcodeAccounts,
        recentFailedSyncs,
      },
      recentSyncLogs,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
