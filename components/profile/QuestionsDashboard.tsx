import Link from "next/link";
import { BookOpen, CheckCircle2, Circle, ExternalLink, ShieldCheck } from "lucide-react";
import type { SheetProgressSummary, SheetQuestionItem } from "@/lib/services/sheets";
import { difficultyClasses } from "@/lib/utils";
import { pointsForDifficulty } from "@/lib/scoring/global";

interface QuestionsDashboardProps {
  sheets: SheetProgressSummary[];
}

/**
 * Profile "Questions Dashboard": per-sheet, auto-derived question status.
 * Every row's solved state comes exclusively from canonical SolvedProblem
 * records matched by externalKey — there is no manual completion control.
 */
export function QuestionsDashboard({ sheets }: QuestionsDashboardProps) {
  if (sheets.length === 0) {
    return (
      <div className="glass-card p-6 rounded-2xl text-center text-xs text-slate-400 space-y-2">
        <BookOpen className="w-6 h-6 mx-auto text-slate-600" />
        <p>No published DSA sheets yet. Once an admin publishes a sheet, your auto-verified progress appears here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sheets.map((sheet) => (
        <div key={sheet.sheet.id} className="glass-card p-5 rounded-2xl space-y-4 border border-slate-800">
          {/* Sheet header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cnOrange-500/10 border border-cnOrange-500/30 flex items-center justify-center text-cnOrange-400 font-bold text-sm">
                {sheet.totalQuestions}
              </div>
              <div>
                <Link
                  href={`/sheets/${sheet.sheet.slug}`}
                  className="font-bold text-sm text-white hover:text-cnOrange-400 transition"
                >
                  {sheet.sheet.name}
                </Link>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  Auto-verified from synced LeetCode data
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">
                Remaining: <strong className="text-white">{sheet.remainingQuestions}</strong>
              </span>
              <span className="text-slate-400">
                Score: <strong className="text-cnOrange-400">{sheet.score}</strong>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-bold text-white">
                {sheet.solvedQuestions} / {sheet.totalQuestions} · {sheet.completionPercent}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden p-0.5 border border-slate-700">
            <div
              className="bg-gradient-to-r from-cnOrange-600 to-amber-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, sheet.completionPercent)}%` }}
            />
          </div>

          {/* Difficulty breakdown of solved questions */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`px-2 py-0.5 rounded border font-bold ${difficultyClasses.EASY}`}>
              Easy {sheet.easySolved}
            </span>
            <span className={`px-2 py-0.5 rounded border font-bold ${difficultyClasses.MEDIUM}`}>
              Medium {sheet.mediumSolved}
            </span>
            <span className={`px-2 py-0.5 rounded border font-bold ${difficultyClasses.HARD}`}>
              Hard {sheet.hardSolved}
            </span>
          </div>

          {/* Next unsolved questions (auto-derived, read-only status) */}
          {(() => {
            const nextUnsolved = sheet.questions.filter((q) => !q.isSolved).slice(0, 3);
            if (nextUnsolved.length === 0) {
              return (
                <div className="flex items-center gap-2 text-[11px] text-emerald-400 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sheet fully solved — outstanding work!</span>
                </div>
              );
            }
            return (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Up next
                </p>
                {nextUnsolved.map((q) => (
                  <UnsolvedRow key={q.id} question={q} />
                ))}
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function UnsolvedRow({ question }: { question: SheetQuestionItem }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-800">
      <div className="flex items-center gap-2 min-w-0">
        <Circle className="w-3 h-3 text-slate-600 flex-shrink-0" />
        <span className="text-xs text-white truncate">{question.title}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase flex-shrink-0 ${
            difficultyClasses[question.difficulty] ?? difficultyClasses.UNKNOWN
          }`}
        >
          {question.difficulty}
        </span>
        <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
          {pointsForDifficulty(question.difficulty)} pts
        </span>
      </div>
      <a
        href={question.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cnOrange-500/10 hover:bg-cnOrange-500/20 text-cnOrange-400 border border-cnOrange-500/30 text-[10px] font-bold transition flex-shrink-0"
      >
        Solve
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
    </div>
  );
}
