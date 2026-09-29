import { UserAvatar } from "@/components/UserAvatar";
import type { SheetLeaderboardEntry } from "@/lib/services/leaderboard";

/** Per-sheet leaderboard standings table (fixed 1/4/8 scoring). */
export function SheetStandings({
  sheetName,
  rows,
}: {
  sheetName: string;
  rows: SheetLeaderboardEntry[];
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
      <div className="p-4 bg-slate-800/60 border-b border-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {sheetName} Leaderboard
        </h3>
        <span className="text-[11px] text-slate-400">
          Easy 1 pt · Medium 4 pts · Hard 8 pts — auto-verified from LeetCode
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <th className="py-3 px-4 w-16">Rank</th>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4 text-center">Sheet Solved</th>
              <th className="py-3 px-4 text-center">Easy</th>
              <th className="py-3 px-4 text-center">Medium</th>
              <th className="py-3 px-4 text-center">Hard</th>
              <th className="py-3 px-4 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No one has solved a question from this sheet yet — be the first!
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.userId}
                  className={`hover:bg-slate-800/60 transition ${
                    row.rank === 1
                      ? "bg-amber-500/5"
                      : row.rank === 2
                      ? "bg-slate-300/5"
                      : row.rank === 3
                      ? "bg-amber-800/5"
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
                        className="border border-slate-600"
                      />
                      <div>
                        <div className="font-bold text-white">{row.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {row.rollNumber || "KIIT Student"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-white">
                    {row.totalSheetSolved} / {row.totalSheetQuestions}
                    <span className="block text-[10px] text-slate-500 font-normal">
                      {row.completionPercent}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-400">{row.easySolved}</td>
                  <td className="py-3 px-4 text-center text-amber-400">{row.mediumSolved}</td>
                  <td className="py-3 px-4 text-center text-rose-400">{row.hardSolved}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-cnOrange-400">
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
