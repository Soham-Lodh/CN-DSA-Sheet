import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminView } from "@/components/admin/AdminView";
import { SheetStatus, SyncStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import type { AdminData } from "@/components/admin/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin Console" };

export default async function AdminPage() {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  const [counts, failedSyncs, sheets, questions, platformAccounts, syncLogs, profiles] =
    await Promise.all([
      prisma.sheet.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.syncLog.count({ where: { status: SyncStatus.FAILED } }),
      prisma.sheet.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { sheetQuestions: true } } },
      }),
      prisma.sheetQuestion.findMany({
        orderBy: { position: "asc" },
        include: { sheet: true, question: true },
      }),
      prisma.platformAccount.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, rollNumber: true, email: true } },
        },
      }),
      prisma.syncLog.findMany({
        take: 8,
        orderBy: { startedAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
      prisma.profile.findMany({
        orderBy: [{ role: "desc" }, { createdAt: "desc" }],
        include: {
          platformAccount: { select: { username: true } },
          _count: { select: { solvedProblems: true } },
        },
      }),
    ]);

  const sheetCount = (status?: SheetStatus) =>
    counts.find((c) => c.status === status)?._count._all ?? 0;

  const data: AdminData = {
    overview: {
      totalUsers: profiles.length,
      totalSheets: sheetCount(),
      publishedSheets: sheetCount(SheetStatus.PUBLISHED),
      totalQuestions: await prisma.question.count(),
      totalSolvedRecords: await prisma.solvedProblem.count(),
      leetcodeAccounts: platformAccounts.length,
      recentFailedSyncs: failedSyncs,
    },
    sheets,
    questions,
    platformAccounts,
    syncLogs,
    profiles,
    currentAdminId: profile.id,
  };

  return <AdminView data={data} />;
}
