"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Loader2 } from "lucide-react";
import type { SheetQuestionItem } from "@/lib/services/sheets";
import type { ScoringConfig } from "@/lib/scoring/global";
import { pointsForDifficulty } from "@/lib/scoring/global";
import { difficultyClasses } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";

interface QuestionsTableProps {
  questions: SheetQuestionItem[];
  /** Per-sheet Easy/Medium/Hard point values (shown in the Points column). */
  scoring: ScoringConfig;
  /**
   * Called once per SET-STATE result. The server's authoritative compact
   * response exactly matches the ProgressMutationResult contract
   * (lib/services/sheets.ts), so parents reconcile committed state instantly
   * without extra API reads. An empty sheet set means the row reconciled to
   * its own authoritative answer only.
   */
  onSettled?: (result: ProgressMutationResponse, nextSolved: boolean) => void;
}

/** Mirrors lib/services/sheets.ts ProgressMutationResult (subset used in UI). */
interface AffectedSheetSummary {
  sheetId: string;
  slug: string;
  name: string;
  totalQuestions: number;
  solvedQuestions: number;
  remainingQuestions: number;
  completionPercent: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  score: number;
  userRow: {
    userId: string;
    name: string;
    rollNumber: string | null;
    avatarUrl: string | null;
    totalSheetSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    score: number;
    completionPercent: number;
  };
}

export interface ProgressMutationResponse {
  questionId: string;
  solved: boolean;
  source: "AUTO" | "MANUAL" | null;
  changed: boolean;
  sheets: AffectedSheetSummary[];
}

interface RowState {
  /** Desired server state currently being applied (or awaiting retry). */
  inFlight: boolean;
  /** Pending set-state payload kept around so a Retry can reuse key+payload. */
  desiredSolved: boolean;
  /** Stable idempotency key for this logical action (kept across retries). */
  idempotencyKey: string;
}

/** Client-side deterministic tie-break for local standings rank updates. */
export function resortEntries<T extends { score: number; totalSheetSolved?: number; totalSolved?: number; rollNumber: string | null; name?: string }>(entries: T[]): (T & { rank: number })[] {
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const solvedA = a.totalSheetSolved ?? a.totalSolved ?? 0;
    const solvedB = b.totalSheetSolved ?? b.totalSolved ?? 0;
    if (solvedB !== solvedA) return solvedB - solvedA;
    const rollA = a.rollNumber || "zzzz";
    const rollB = b.rollNumber || "zzzz";
    const cmp = rollA.localeCompare(rollB);
    if (cmp !== 0) return cmp;
    const nameA = a.name ?? "";
    const nameB = b.name ?? "";
    return nameA.localeCompare(nameB);
  });
  return entries.map((e, idx) => ({ ...e, rank: idx + 1 }));
}

function randomKey(): string {
  const crypto = globalThis.crypto;
  if (crypto && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Filterable sheet questions table. The status checkbox is interactive:
 * solved questions show an orange ✅ (whether auto-verified from synced
 * LeetCode data or manually ticked). Every click is an optimistic SET of the
 * desired boolean state — independent rows can change in parallel — and a
 * failure rolls back to the last authoritative value with a Retry toast that
 * reuses the same idempotency key (safe after ambiguous network timeouts).
 */
export function QuestionsTable({ questions, scoring, onSettled }: QuestionsTableProps) {
  // Rows with an in-flight or error-pending set-state, keyed by question id.
  // Per-row state (never one global slot) so parallel clicks cannot collide.
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  // Optimistic solved-state overrides: the value shown while authoritative
  // data still reflects the previous state.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  // Last authoritative value per question, used for safe rollback.
  const lastAuthoritativeSolved = useRef<Record<string, boolean>>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Keep ref in sync with incoming props without clobbering in-flight rows.
  useEffect(() => {
    for (const q of questions) {
      lastAuthoritativeSolved.current[q.id] = q.isSolved;
    }
    // Clear overrides that now equal authoritative state (no in-flight row).
    setOverrides((prev) => {
      const next: Record<string, boolean> = {};
      for (const [id, value] of Object.entries(prev)) {
        if (rowStates[id]?.inFlight) {
          next[id] = value;
          continue;
        }
        if (lastAuthoritativeSolved.current[id] !== value) next[id] = value;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const isSolvedFor = (q: SheetQuestionItem) => overrides[q.id] ?? q.isSolved;

  const sendState = useCallback(
    async (question: SheetQuestionItem, desiredSolved: boolean, idempotencyKey: string) => {
      // Optimistic update first (Instagram-like: UI reacts instantly).
      setRowStates((prev) => ({
        ...prev,
        [question.id]: { inFlight: true, desiredSolved, idempotencyKey },
      }));
      setOverrides((prev) => ({ ...prev, [question.id]: desiredSolved }));

      try {
        const res = await fetch("/api/sheets/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Same key across retries: the server deduplicates and replays.
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            questionId: question.id,
            solved: desiredSolved,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | (ProgressMutationResponse & { error?: { message?: string; retryable?: boolean; code?: string } })
          | null;
        if (!res.ok || !data || data.error) {
          const errBody = data?.error;
          throw Object.assign(
            new Error(errBody?.message || "Failed to save your progress"),
            { retryable: errBody?.retryable ?? false, code: errBody?.code }
          );
        }

        if (!mounted.current) return;

        // Reconcile with the committed authoritative state.
        setOverrides((prev) => {
          const next = { ...prev };
          if (lastAuthoritativeSolved.current[question.id] !== data.solved) {
            next[question.id] = data.solved;
          } else {
            delete next[question.id];
          }
          return next;
        });
        setRowStates((prev) => {
          const next = { ...prev };
          delete next[question.id];
          return next;
        });
        onSettled?.(data, data.solved);
        if (data.changed || desiredSolved) {
          showToast({
            variant: "success",
            message:
              data.source === "AUTO"
                ? "Verified from your synced LeetCode submissions"
                : data.changed
                  ? desiredSolved
                    ? "Marked as solved" + (data.source === "MANUAL" ? "" : "")
                    : "Marked as unsolved"
                  : "Progress already saved",
            durationMs: 2500,
          });
        } else {
          showToast({
            variant: "success",
            message: desiredSolved ? "Already marked solved" : "Already marked unsolved",
            durationMs: 2500,
          });
        }
      } catch (err) {
        const error = err as Error & { retryable?: boolean };
        // Roll back the optimistic UI to the last authoritative value.
        const authoritative = lastAuthoritativeSolved.current[question.id];
        setOverrides((prev) => {
          const next = { ...prev };
          if (authoritative === undefined) delete next[question.id];
          else next[question.id] = authoritative;
          return next;
        });
        if (mounted.current) {
          setRowStates((prev) => ({
            ...prev,
            [question.id]: { inFlight: false, desiredSolved, idempotencyKey },
          }));
        }
        const wasNetworkError = error.message.includes("fetch");
        showToast({
          variant: "error",
          message: wasNetworkError
            ? "Connection lost — your change may not have been saved."
            : `Couldn't save: ${error.message}`,
          actionLabel: "Retry",
          onAction: () => {
            if (mounted.current) {
              void sendState(question, desiredSolved, idempotencyKey);
            }
          },
        });
      }
    },
    [onSettled]
  );

  const toggle = (q: SheetQuestionItem) => {
    // While a row is in flight, suppress duplicate submits for that row only;
    // other rows remain clickable in parallel.
    const current = rowStates[q.id];
    if (current?.inFlight) return;
    // Out-of-order safety: base the desired value on the last authoritative
    // state (or an existing pending desired value) rather than previous UI.
    const base = overrides[q.id] ?? q.isSolved;
    const desired = !base;
    void sendState(q, desired, randomKey());
  };

  const currentQuestions = questions.map((q) => {
    const state = rowStates[q.id];
    return {
      q,
      isSolved: overrides[q.id] ?? q.isSolved,
      isPending: Boolean(state?.inFlight),
      isRetryAvailable: state && !state.inFlight,
    };
  });

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-outline-subtle">
      {error && (
        <div className="p-3 bg-status-danger/10 border-b border-status-danger/30 text-status-danger text-xs">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-surface-elevated/80 text-content-muted font-semibold uppercase tracking-wider border-b border-outline-subtle">
              <th scope="col" className="py-3 px-3 sm:px-4 w-14 text-center">Solved</th>
              <th scope="col" className="py-3 px-3 sm:px-4 w-14 text-center">#</th>
              <th scope="col" className="py-3 px-3 sm:px-4">Problem Name</th>
              <th scope="col" className="py-3 px-3 sm:px-4">Topic</th>
              <th scope="col" className="py-3 px-3 sm:px-4">Difficulty</th>
              <th scope="col" className="py-3 px-3 sm:px-4 text-center">Points</th>
              <th scope="col" className="py-3 px-3 sm:px-4 text-center">Solve</th>
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
              currentQuestions.map(({ q, isSolved, isPending, isRetryAvailable }) => (
                <tr
                  key={q.id}
                  className={`transition hover:bg-surface-elevated/60 ${isSolved ? "bg-outline-hairline" : ""}`}
                >
                  <td className="py-3 px-3 sm:px-4 text-center">
                    <button
                      onClick={() => toggle(q)}
                      disabled={isPending}
                      aria-pressed={isSolved}
                      aria-label={
                        isSolved
                          ? `Mark "${q.title}" as not solved`
                          : `Mark "${q.title}" as solved`
                      }
                      title={
                        isRetryAvailable
                          ? "A previous change failed — press again or use Retry"
                          : isSolved
                            ? "Solved — click to mark unsolved"
                            : "Mark as solved"
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-elevated disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      {isPending ? (
                        <Loader2 className="w-4 h-4 text-content-muted animate-spin" aria-hidden />
                      ) : isSolved ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-accent" aria-hidden />
                      ) : (
                        <Circle className="w-4 h-4 text-content-muted hover:text-brand-accent" aria-hidden />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-center font-mono text-content-muted">{q.position}</td>
                  <td className="py-3 px-3 sm:px-4">
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-content-primary hover:text-brand-accent transition"
                    >
                      {q.title}
                    </a>
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-content-secondary">
                    <span className="bg-surface-elevated/80 px-2 py-0.5 rounded text-[11px] border border-outline-subtle/60">
                      {q.topic}
                    </span>
                  </td>
                  <td className="py-3 px-3 sm:px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                        difficultyClasses[q.difficulty] ?? difficultyClasses.UNKNOWN
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-center font-mono text-[11px] text-brand-accent font-bold">
                    {pointsForDifficulty(q.difficulty, scoring)}
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-center">
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-accent border border-brand-primary/30 text-[11px] font-bold transition"
                    >
                      <span>Solve</span>
                      <ExternalLink className="w-3 h-3" aria-hidden />
                    </a>
                  </td>
                </tr>
              ))
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

