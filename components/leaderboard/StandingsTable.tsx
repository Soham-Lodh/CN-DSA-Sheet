"use client";

import { Search } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import type { GlobalLeaderboardEntry } from "@/lib/services/leaderboard";

type Entry = GlobalLeaderboardEntry;

interface StandingsTableProps {
  rows: Entry[];
  currentUserId?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const medalFor = (rank: number) =>
  rank === 1 ? "🥇 #1" : rank === 2 ? "🥈 #2" : rank === 3 ? "🥉 #3" : `#${rank}`;

const rankClasses = (rank: number) =>
  rank === 1
    ? "text-brand-accent font-extrabold"
    : rank === 2
    ? "text-content-secondary font-extrabold"
    : rank === 3
    ? "text-rank-bronze font-extrabold"
    : "text-content-muted font-mono";

/** Global KIIT standings: roll, name, total, easy/medium/hard split and score. */
export function StandingsTable({
  rows,
  currentUserId,
  searchQuery,
  onSearchChange,
}: StandingsTableProps) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-outline-subtle space-y-4 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-content-secondary">
            KIIT Chapter Overall Standings
          </h2>
          <span className="text-xs text-content-muted">
            Showing {rows.length} registered coders
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search student or roll no..."
            className="w-full bg-surface-page border border-outline-subtle rounded-lg pl-9 pr-3 py-1.5 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:border-brand-primary transition"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-page/80 text-content-muted uppercase font-semibold border-b border-outline-subtle">
              <th className="py-3 px-4 w-16">Rank</th>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">LeetCode</th>
              <th className="py-3 px-4 text-center">Total Solved</th>
              <th className="py-3 px-4 text-center">Easy</th>
              <th className="py-3 px-4 text-center">Medium</th>
              <th className="py-3 px-4 text-center">Hard</th>
              <th className="py-3 px-4 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-subtle/60 font-medium">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-content-muted">
                  No coders found for this leaderboard.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isCurrentUser = row.userId === currentUserId;

                return (
                  <tr
                    key={row.userId}
                    className={`hover:bg-surface-elevated/60 transition ${
                      isCurrentUser ? "bg-brand-primary/10 border-l-2 border-l-brand-primary" : ""
                    }`}
                  >
                    <td className={`py-3 px-4 ${rankClasses(row.rank)}`}>{medalFor(row.rank)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          avatarUrl={row.avatarUrl}
                          name={row.name}
                          sizeClasses="w-7 h-7"
                          className="border border-outline-subtle"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-content-primary">{row.name}</span>
                            {isCurrentUser && (
                              <span className="text-[10px] bg-brand-primary/30 text-brand-accent px-1.5 py-0.5 rounded font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-content-muted font-mono">
                            {row.rollNumber || "KIIT Student"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-content-secondary">
                      {row.leetcodeUsername || "—"}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-content-primary">
                      {row.totalSolved}
                    </td>
                    <td className="py-3 px-4 text-center text-status-success">{row.easySolved}</td>
                    <td className="py-3 px-4 text-center text-brand-accent">{row.mediumSolved}</td>
                    <td className="py-3 px-4 text-center text-status-danger">{row.hardSolved}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-accent">
                      {row.score} pts
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
