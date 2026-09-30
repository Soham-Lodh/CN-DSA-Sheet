"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Loader2 } from "lucide-react";
import type { SheetQuestionItem } from "@/lib/services/sheets";
import type { ScoringConfig } from "@/lib/scoring/global";
import { pointsForDifficulty } from "@/lib/scoring/global";
import { difficultyClasses } from "@/lib/utils";

interface QuestionsTableProps {
  questions: SheetQuestionItem[];
  /** Per-sheet Easy/Medium/Hard point values (shown in the Points column). */
  scoring: ScoringConfig;
  /** Called after a successful manual toggle so parents can refresh counts. */
  onToggleComplete?: () => void;
}

/**
 * Filterable sheet questions table. The status checkbox is interactive:
 * solved questions show an orange ✅ (whether auto-verified from synced
 * LeetCode data or manually ticked); unticking persists to the DB and
 * counts toward sheet progress + leaderboards.
 */
export function QuestionsTable({ questions, scoring, onToggleComplete }: QuestionsTableProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local solved-state overrides mirror the server; re-synced on prop change.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isSolvedFor = (q: SheetQuestionItem) => overrides[q.id] ?? q.isSolved;

  const toggle = async (q: SheetQuestionItem) => {
    const nextSolved = !isSolvedFor(q);
    setPending(q.id);
    setError(null);
    setOverrides((prev) => ({ ...prev, [q.id]: nextSolved }));
    try {
      const res = await fetch("/api/sheets/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, solved: nextSolved }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update progress");
      onToggleComplete?.();
    } catch (err: any) {
      setError(err.message || "Failed to update progress");
      // Revert optimistic update on failure.
      setOverrides((prev) => {
        const copy = { ...prev };
        delete copy[q.id];
        return copy;
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-outline-subtle">
      {error && (
        <div className="p-3 bg-status-danger/10 border-b border-status-danger/30 text-status-danger text-xs">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-elevated/80 text-content-muted font-semibold uppercase tracking-wider border-b border-outline-subtle">
              <th className="py-3 px-4 w-14 text-center">Solved</th>
              <th className="py-3 px-4 w-14 text-center">#</th>
              <th className="py-3 px-4">Problem Name</th>
              <th className="py-3 px-4">Topic</th>
              <th className="py-3 px-4">Difficulty</th>
              <th className="py-3 px-4 text-center">Points</th>
              <th className="py-3 px-4 text-center">Solve</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-subtle/60 font-medium">
            {questions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-content-muted">
                  No problems match your current filter criteria.
                </td>
              </tr>
            ) : (
              questions.map((q) => {
                const isSolved = isSolvedFor(q);
                const isPending = pending === q.id;

                return (
                  <tr
                    key={q.id}
                    className={`transition hover:bg-surface-elevated/60 ${isSolved ? "bg-outline-hairline" : ""}`}
                  >
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggle(q)}
                        disabled={isPending}
                        title={
                          isSolved
                            ? "Solved — click to untick"
                            : "Mark as solved"
                        }
                        className="inline-flex items-center justify-center disabled:opacity-60 cursor-pointer"
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 text-content-muted animate-spin" />
                        ) : isSolved ? (
                          <CheckCircle2 className="w-4 h-4 text-brand-accent" />
                        ) : (
                          <Circle className="w-4 h-4 text-content-muted hover:text-brand-accent" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-content-muted">{q.position}</td>
                    <td className="py-3 px-4">
                      <a
                        href={q.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-content-primary hover:text-brand-accent transition"
                      >
                        {q.title}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-content-secondary">
                      <span className="bg-surface-elevated/80 px-2 py-0.5 rounded text-[11px] border border-outline-subtle/60">
                        {q.topic}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                          difficultyClasses[q.difficulty] ?? difficultyClasses.UNKNOWN
                        }`}
                      >
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[11px] text-brand-accent font-bold">
                      {pointsForDifficulty(q.difficulty, scoring)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <a
                        href={q.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-accent border border-brand-primary/30 text-[11px] font-bold transition"
                      >
                        <span>Solve</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[10px] text-content-muted border-t border-outline-subtle/60">
        ✅ orange = solved (auto-verified from LeetCode or manually marked). Click any circle to
        toggle; manual ticks count toward progress and leaderboards.
      </p>
    </div>
  );
}
