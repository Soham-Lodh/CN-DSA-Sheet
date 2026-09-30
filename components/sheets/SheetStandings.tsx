import { UserAvatar } from "@/components/UserAvatar";
import type { SheetLeaderboardEntry } from "@/lib/services/leaderboard";
import type { ScoringConfig } from "@/lib/scoring/global";

/** Per-sheet leaderboard standings table (scored with the sheet's own points). */
export function SheetStandings({
  sheetName,
  rows,
  scoring = { easyPoints: 3, mediumPoints: 5, hardPoints: 8 },
}: {
  sheetName: string;
  rows: SheetLeaderboardEntry[];
  scoring?: ScoringConfig;
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-outline-subtle">
      <div className="p-4 bg-surface-elevated/60 border-b border-outline-subtle flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
          {sheetName} Leaderboard
        </h3>
        <span className="text-[11px] text-content-muted">
          Easy {scoring.easyPoints} pt · Medium {scoring.mediumPoints} pts · Hard {scoring.hardPoints} pts —
          auto-verified from LeetCode + manual ticks
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-page/80 text-content-muted uppercase font-semibold border-b border-outline-subtle">
              <th className="py-3 px-4 w-16">Rank</th>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4 text-center">Sheet Solved</th>
              <th className="py-3 px-4 text-center">Easy</th>
              <th className="py-3 px-4 text-center">Medium</th>
              <th className="py-3 px-4 text-center">Hard</th>
              <th className="py-3 px-4 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-subtle/60 font-medium">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-content-muted">
                  No one has solved a question from this sheet yet — be the first!
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.userId}
                  className={`hover:bg-surface-elevated/60 transition ${
                    row.rank === 1
                      ? "bg-brand-accent/5"
                      : row.rank === 2
                      ? "bg-rank-silver/10"
                      : row.rank === 3
                      ? "bg-rank-bronze/10"
                      : ""
                  }`}
                >
                  <td className={`py-3 px-4 ${row.rank <= 3 ? "font-black" : "font-mono"}`}>
                    {row.rank === 1
                      ? "🥇 #1"
                      : row.rank === 2
                      ? "🥈 #2"
                      : row.rank === 3
                      ? "🥉 #3"
                      : `#${row.rank}`}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        avatarUrl={row.avatarUrl}
                        name={row.name}
                        sizeClasses="w-7 h-7"
                        className="border border-outline-subtle"
                      />
                      <div>
                        <div className="font-bold text-content-primary">{row.name}</div>
                        <div className="text-[10px] text-content-muted font-mono">
                          {row.rollNumber || "KIIT Student"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-content-primary">
                    {row.totalSheetSolved} / {row.totalSheetQuestions}
                    <span className="block text-[10px] text-content-muted font-normal">
                      {row.completionPercent}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-status-success">{row.easySolved}</td>
                  <td className="py-3 px-4 text-center text-brand-accent">{row.mediumSolved}</td>
                  <td className="py-3 px-4 text-center text-status-danger">{row.hardSolved}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-brand-accent">
                    {row.score} pts
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
