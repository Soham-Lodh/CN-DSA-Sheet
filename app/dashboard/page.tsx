import Link from "next/link";
import { resolveCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGlobalLeaderboard, rankOfUser } from "@/lib/services/leaderboard";
import { getAllSheetsWithUserProgress } from "@/lib/services/sheets";
import { getCombinedActivity } from "@/lib/services/activity";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { ActivityHeatmap } from "@/components/activity/ActivityHeatmap";
import { SCORING_POINTS } from "@/lib/scoring/global";
import { sum, percent } from "@/lib/utils";
import {
  CheckCircle,
  ListOrdered,
  PieChart,
  Trophy,
  ArrowRight,
  Sparkles,
  Calendar,
  Clock,
  PlusCircle,
} from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

const difficultyClasses: Record<string, string> = {
  EASY: "text-emerald-400",
  MEDIUM: "text-amber-400",
  HARD: "text-rose-400",
};

export default async function DashboardPage() {
  const { profile, reason } = await resolveCurrentProfile().catch(() => ({
    profile: null,
    reason: "NO_SESSION" as const,
  }));

  if (!profile) {
    redirect(reason === "INVALID_DOMAIN" ? "/?error=invalid_domain" : "/");
  }

  const [leaderboard, sheetsProgress, snapshot, recentSolved, hasAccount, activity] =
    await Promise.all([
      getGlobalLeaderboard(),
      getAllSheetsWithUserProgress(profile.id),
      prisma.platformSnapshot.findUnique({ where: { userId: profile.id } }),
      prisma.solvedProblem.findMany({
        where: { userId: profile.id },
        orderBy: { firstSeenAt: "desc" },
        take: 6,
      }),
      prisma.platformAccount.findUnique({ where: { userId: profile.id } }),
      getCombinedActivity(profile.id),
    ]);

  const globalRank = rankOfUser(profile.id, leaderboard);
  const totalSolved = snapshot?.totalSolved ?? 0;
  const totalSheetQuestions = sum(sheetsProgress, (s) => s.totalQuestions);
  const totalSheetSolved = sum(sheetsProgress, (s) => s.solvedQuestions);

  const remainingQuestions = Math.max(0, totalSheetQuestions - totalSheetSolved);
  const completionRate = percent(totalSheetSolved, totalSheetQuestions);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl relative overflow-hidden border-l-4 border-l-cnOrange-500">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, <span className="gradient-orange-text">{profile.name}</span>! 👋
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            {profile.rollNumber ? `Roll No: ${profile.rollNumber} • ` : ""}
            Your LeetCode stats sync automatically — scoring is Easy {SCORING_POINTS.EASY} / Medium {SCORING_POINTS.MEDIUM} / Hard {SCORING_POINTS.HARD} pts.
          </p>
        </div>
        <Link
          href="/sheets"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cnOrange-500 to-amber-500 hover:from-cnOrange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cnOrange-500/25 transition flex items-center gap-2"
        >
          <span>Continue Solving</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Platform Connection Alert if not connected */}
      {!hasAccount && (
        <div className="glass-card p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-200">
              Connect your LeetCode account to auto-sync your solved problems, heatmap and rankings.
            </p>
          </div>
          <Link
            href="/profile"
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 flex-shrink-0 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Connect LeetCode</span>
          </Link>
        </div>
      )}

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Problems Solved"
          value={`${totalSolved} (${totalSheetSolved} in sheets)`}
          footer={
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle className="w-3 h-3" /> Verified from LeetCode
            </p>
          }
          icon={CheckCircle}
          iconClasses="bg-cnOrange-500/10 border-cnOrange-500/20 text-cnOrange-500"
        />
        <MetricCard
          label="Remaining Sheet Questions"
          value={String(remainingQuestions)}
          footer={
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" /> Out of {totalSheetQuestions} total
            </p>
          }
          icon={ListOrdered}
          iconClasses="bg-amber-500/10 border-amber-500/20 text-amber-500"
        />
        <MetricCard
          label="Sheet Completion Rate"
          value={`${completionRate}%`}
          footer={
            <p className="text-xs text-blue-400 mt-1 flex items-center gap-1 font-medium">
              <PieChart className="w-3 h-3" /> Across all published sheets
            </p>
          }
          icon={PieChart}
          iconClasses="bg-blue-500/10 border-blue-500/20 text-blue-400"
        />
        <MetricCard
          label="KIIT Chapter Rank"
          value={globalRank ? `#${globalRank}` : "Unranked"}
          footer={
            <p className="text-xs text-cnOrange-400 mt-1 flex items-center gap-1 font-medium">
              <Trophy className="w-3 h-3 text-cnOrange-500" /> KIIT Leaderboard
            </p>
          }
          icon={Trophy}
          iconClasses="bg-cnOrange-500/20 border-cnOrange-500/40 text-cnOrange-500"
        />
      </div>

      {/* Sheet Progress Breakdown Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cnOrange-500" />
            <span>Curated DSA Sheets Progress</span>
          </h2>
          <Link href="/sheets" className="text-xs text-cnOrange-400 hover:underline">
            View all sheets &rarr;
          </Link>
        </div>

        {sheetsProgress.length === 0 ? (
          <div className="glass-card p-6 rounded-2xl text-center text-slate-400 text-xs">
            No published DSA sheets currently available.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sheetsProgress.map((sheet, index) => {
              const isFirst = index % 2 === 0;

              return (
                <Link
                  key={sheet.id}
                  href={`/sheets/${sheet.slug}`}
                  className="glass-card glass-card-hover p-6 rounded-2xl space-y-4 block group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border ${
                          isFirst
                            ? "bg-cnOrange-500/10 border-cnOrange-500/30 text-cnOrange-400"
                            : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                        }`}
                      >
                        {sheet.totalQuestions}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white group-hover:text-cnOrange-400 transition">
                          {sheet.name}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-1">
                          {sheet.description || "Curated interview preparation problem set"}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white">
                      {sheet.solvedQuestions} / {sheet.totalQuestions}
                    </span>
                  </div>

                  <ProgressBar percent={sheet.completionPercent} />

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>Automated LeetCode Verification</span>
                    <span className="font-bold text-white">{sheet.completionPercent}% Done</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Heatmap & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cnOrange-500" />
              <span>Coding Activity (Last 1 Year)</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total Solved: <strong className="text-white">{totalSolved}</strong>
            </span>
          </div>

          <ActivityHeatmap activity={activity} />
        </div>

        {/* Recent Solved Submissions Feed */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cnOrange-500" />
            <span>Recent Solved Problems</span>
          </h3>

          {recentSolved.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">
              No recent solutions synced yet. Connect your LeetCode account and sync to populate activity.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentSolved.map((prob) => (
                <div
                  key={prob.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white line-clamp-1">
                      {prob.title || prob.externalKey}
                    </p>
                    <span
                      className={`text-[10px] font-medium capitalize ${
                        difficultyClasses[prob.difficulty] ?? "text-slate-400"
                      }`}
                    >
                      leetcode • {prob.difficulty.toLowerCase()}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                    {prob.solvedAt ? new Date(prob.solvedAt).toLocaleDateString() : "Verified"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
