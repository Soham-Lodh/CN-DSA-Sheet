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
    ? "text-amber-400 font-extrabold"
    : rank === 2
    ? "text-slate-300 font-extrabold"
    : rank === 3
    ? "text-amber-600 font-extrabold"
    : "text-slate-400 font-mono";

/** Global KIIT standings: roll, name, total, easy/medium/hard split and score. */
export function StandingsTable({
  rows,
  currentUserId,
  searchQuery,
  onSearchChange,
}: StandingsTableProps) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-slate-800 space-y-4 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            KIIT Chapter Overall Standings
          </h2>
          <span className="text-xs text-slate-400">
            Showing {rows.length} registered coders
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search student or roll no..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cnOrange-500 transition"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
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
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No coders found for this leaderboard.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isCurrentUser = row.userId === currentUserId;

                return (
                  <tr
                    key={row.userId}
                    className={`hover:bg-slate-800/60 transition ${
                      isCurrentUser ? "bg-cnOrange-500/10 border-l-2 border-l-cnOrange-500" : ""
                    }`}
                  >
                    <td className={`py-3 px-4 ${rankClasses(row.rank)}`}>{medalFor(row.rank)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          avatarUrl={row.avatarUrl}
                          name={row.name}
                          sizeClasses="w-7 h-7"
                          className="border border-slate-600"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{row.name}</span>
                            {isCurrentUser && (
                              <span className="text-[10px] bg-cnOrange-500/30 text-cnOrange-300 px-1.5 py-0.5 rounded font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {row.rollNumber || "KIIT Student"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {row.leetcodeUsername || "—"}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-white">
                      {row.totalSolved}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-400">{row.easySolved}</td>
                    <td className="py-3 px-4 text-center text-amber-400">{row.mediumSolved}</td>
                    <td className="py-3 px-4 text-center text-rose-400">{row.hardSolved}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cnOrange-400">
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
