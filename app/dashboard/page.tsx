import Link from "next/link";
import { resolveCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGlobalLeaderboard, rankOfUser } from "@/lib/services/leaderboard";
import { getAllSheetsWithUserProgress } from "@/lib/services/sheets";
import { getCombinedActivity } from "@/lib/services/activity";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SheetsCarousel } from "@/components/dashboard/SheetsCarousel";
import { ActivityHeatmap } from "@/components/activity/ActivityHeatmap";
import { sum } from "@/lib/utils";
import { cachedRead, CACHE_TAGS, TTL } from "@/lib/cache";
import { fetchLeetCodePotd } from "@/lib/platform/leetcode";
import {
  CheckCircle,
  ListOrdered,
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

export default async function DashboardPage() {
  const { profile, reason } = await resolveCurrentProfile().catch(() => ({
    profile: null,
    reason: "NO_SESSION" as const,
  }));

  if (!profile) {
    redirect(reason === "INVALID_DOMAIN" ? "/?error=invalid_domain" : "/");
  }

  const [leaderboard, sheetsProgress, snapshot, hasAccount, activity, potd] =
    await Promise.all([
      getGlobalLeaderboard(),
      getAllSheetsWithUserProgress(profile.id),
      prisma.platformSnapshot.findUnique({ where: { userId: profile.id } }),
      prisma.platformAccount.findUnique({ where: { userId: profile.id } }),
      getCombinedActivity(profile.id),
      // POTD link is an external fetch: cached (30 min TTL) so page render
      // never blocks on LeetCode; falls back on provider failure.
      cachedRead(
        ["potd-link"],
        [CACHE_TAGS.potd],
        Math.min(TTL.potd, 1800),
        fetchLeetCodePotd
      ),
    ]);

  const globalRank = rankOfUser(profile.id, leaderboard);
  const totalSolved = snapshot?.totalSolved ?? 0;
  const totalSheetQuestions = sum(sheetsProgress, (s) => s.totalQuestions);
  const totalSheetSolved = sum(sheetsProgress, (s) => s.solvedQuestions);

  const remainingQuestions = Math.max(
    0,
    totalSheetQuestions - totalSheetSolved,
  );

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-5 rounded-2xl relative overflow-hidden border-l-4 border-l-brand-primary">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome,{" "}
            <span className="gradient-orange-text">{profile.name}</span> 👋
          </h1>
          <p className="text-content-muted text-xs sm:text-sm">
            Solve. Compete. Climb.
          </p>
        </div>
        <Link
          href={potd ?? "https://leetcode.com/problemset/"}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-primary to-brand-accent hover:from-brand-primary hover:to-rank-bronze text-content-primary font-bold text-xs sm:text-sm shadow-lg shadow-brand-primary/25 transition flex items-center gap-2"
        >
          <span>View Today&apos;s POTD</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Platform Connection Alert if not connected */}
      {!hasAccount && (
        <div className="glass-card p-4 rounded-xl border border-brand-accent/30 bg-brand-accent/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-brand-accent flex-shrink-0" />
            <p className="text-xs text-status-warning">
              Connect your LeetCode account to auto-sync your solved problems,
              heatmap and rankings.
            </p>
          </div>
          <Link
            href="/profile"
            className="px-3 py-1.5 rounded-lg bg-brand-accent hover:bg-rank-bronze text-content-inverse font-bold text-xs flex items-center gap-1.5 flex-shrink-0 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Connect LeetCode</span>
          </Link>
        </div>
      )}

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-center">
        <MetricCard
          label="Total Problems Solved"
          value={`${totalSolved}`}
          footer={
            <p className="text-xs text-status-success mt-1 flex items-center gap-1 font-medium">
              <CheckCircle className="w-3 h-3" /> Verified from LeetCode
            </p>
          }
          icon={CheckCircle}
          iconClasses="bg-brand-primary/10 border-brand-primary/20 text-brand-primary"
        />
        <MetricCard
          label="KIIT Chapter Rank"
          value={globalRank ? `#${globalRank}` : "Unranked"}
          footer={
            <p className="text-xs text-brand-accent mt-1 flex items-center gap-1 font-medium">
              <Trophy className="w-3 h-3 text-brand-primary" /> KIIT Leaderboard
            </p>
          }
          icon={Trophy}
          iconClasses="bg-brand-primary/20 border-brand-primary/40 text-brand-primary"
        />
        <MetricCard
          label="Remaining Sheet Questions"
          value={String(remainingQuestions)}
          footer={
            <p className="text-xs text-content-muted mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-brand-accent" /> Out of{" "}
              {totalSheetQuestions} total
            </p>
          }
          icon={ListOrdered}
          iconClasses="bg-brand-accent/10 border-brand-accent/20 text-brand-accent"
        />
      </div>

      {/* Sheet Progress Breakdown Cards */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-content-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-primary" />
            <span>Curated DSA Sheets Progress</span>
          </h2>
          <Link
            href="/sheets"
            className="text-xs text-brand-accent hover:underline"
          >
            View all sheets &rarr;
          </Link>
        </div>

        {sheetsProgress.length === 0 ? (
          <div className="glass-card p-6 rounded-2xl text-center text-content-muted text-xs">
            No published DSA sheets currently available.
          </div>
        ) : (
          <SheetsCarousel sheets={sheetsProgress} />
        )}
      </div>

      {/* Heatmap & Recent Activity Feed */}
      <div className="glass-card p-6 rounded-2xl lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm sm:text-base text-content-primary flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-primary" />
            <span>Coding Activity (Current Year)</span>
          </h3>
        </div>

        <ActivityHeatmap activity={activity} />
      </div>
    </div>
  );
}
