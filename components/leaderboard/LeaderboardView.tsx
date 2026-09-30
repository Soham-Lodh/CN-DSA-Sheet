"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { Podium } from "./Podium";
import { StandingsTable } from "./StandingsTable";
import type { GlobalLeaderboardEntry } from "@/lib/services/leaderboard";
import { SCORING_POINTS } from "@/lib/scoring/global";

interface LeaderboardViewProps {
  globalData: GlobalLeaderboardEntry[];
  currentUserId?: string;
  currentUserRank?: number | null;
}

/** Client container for the global KIIT leaderboard: search, podium, table. */
export function LeaderboardView({
  globalData,
  currentUserId,
  currentUserRank,
}: LeaderboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery) return globalData;
    const q = searchQuery.toLowerCase();
    return globalData.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.rollNumber && item.rollNumber.toLowerCase().includes(q)) ||
        (item.leetcodeUsername && item.leetcodeUsername.toLowerCase().includes(q))
    );
  }, [globalData, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-2xl border-l-4 border-l-brand-accent flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-content-primary flex items-center gap-2">
            <Trophy className="w-6 h-6 text-brand-accent" />
            <span>KIIT Chapter Leaderboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1">
            Ranked from verified LeetCode submissions · Scoring: Easy{" "}
            <strong className="text-status-success">{SCORING_POINTS.EASY} pt</strong> · Medium{" "}
            <strong className="text-brand-accent">{SCORING_POINTS.MEDIUM} pts</strong> · Hard{" "}
            <strong className="text-status-danger">{SCORING_POINTS.HARD} pts</strong>
          </p>
        </div>

        {currentUserRank && (
          <div className="text-xs font-mono bg-surface-page border border-outline-subtle px-4 py-2.5 rounded-xl text-content-secondary flex items-center gap-2 self-start md:self-auto">
            <span>Your Global Rank: </span>
            <strong className="text-brand-accent text-sm">#{currentUserRank}</strong>
          </div>
        )}
      </div>

      {/* Top 3 Podium Cards - always from the unfiltered list */}
      {globalData.length > 0 && <Podium top3={globalData.slice(0, 3)} />}

      {/* Standings Table Card */}
      <StandingsTable
        rows={filtered}
        currentUserId={currentUserId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </div>
  );
}
