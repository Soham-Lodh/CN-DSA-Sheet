"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SheetProgressSummary } from "@/lib/services/sheets";
import type { SheetLeaderboardEntry } from "@/lib/services/leaderboard";
import { BookMarked, Loader2, Search, Trophy } from "lucide-react";
import { QuestionsTable } from "./QuestionsTable";
import { SheetStandings } from "./SheetStandings";
import { resortEntries } from "./QuestionsTable";
import type { ProgressMutationResponse } from "./QuestionsTable";

interface SheetsViewProps {
  initialSheets: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    totalQuestions: number;
    solvedQuestions: number;
    completionPercent: number;
  }[];
  activeSheetData: SheetProgressSummary | null;
  sheetLeaderboard?: SheetLeaderboardEntry[];
}

const difficulties = ["EASY", "MEDIUM", "HARD"] as const;

/** Client container for the sheets view: sheet dropdown, progress stats, filters and tabs. */
export function SheetsView({ initialSheets, activeSheetData, sheetLeaderboard = [] }: SheetsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"questions" | "leaderboard">("questions");
  const [searchQuery, setSearchQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Live client state, reconciled directly from the progress mutation's
  // authoritative response — no full refetch, no page reload needed for the
  // checkbox to flow into totals and standings.
  const [sheetData, setSheetData] = useState<SheetProgressSummary | null>(activeSheetData);
  const [standings, setStandings] = useState<SheetLeaderboardEntry[]>(sheetLeaderboard);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStale, setRefreshStale] = useState(false);

  const updateFromMutation = (result: ProgressMutationResponse) => {
    const summary = result.sheets.find(
      (s) => docSheetMatches(s.sheetId ?? s.slug, sheetData)
    ) ?? result.sheets[0];
    if (!summary) return;

    setSheetData((prev) => {
      if (!prev) return prev;
      const matchForThisSheet =
        result.sheets.find((s) => s.slug === prev.sheet.slug) ?? summary;
      // Trust the server's committed headline numbers; reflect the changed
      // question row locally so filters (solved/unsolved) stay consistent.
      const questions = prev.questions.map((q) =>
        q.id === result.questionId
          ? { ...q, isSolved: result.solved, solvedSource: result.source, solvedAt: null }
          : q
      );
      return {
        ...prev,
        questions,
        solvedQuestions: matchForThisSheet.solvedQuestions,
        remainingQuestions: matchForThisSheet.remainingQuestions,
        completionPercent: matchForThisSheet.completionPercent,
        easySolved: matchForThisSheet.easySolved,
        mediumSolved: matchForThisSheet.mediumSolved,
        hardSolved: matchForThisSheet.hardSolved,
        score: matchForThisSheet.score,
        totalQuestions: matchForThisSheet.totalQuestions,
      };
    });

    // Update standings optimistically: replace this user's row and re-rank
    // with the same deterministic tie-break the server uses.
    setStandings((prev) => {
      const withoutUser = prev.filter((row) => row.userId !== summary.userRow.userId);
      const newRow: SheetLeaderboardEntry = {
        rank: 0,
        userId: summary.userRow.userId,
        name: summary.userRow.name,
        rollNumber: summary.userRow.rollNumber,
        avatarUrl: summary.userRow.avatarUrl,
        totalSheetSolved: summary.userRow.totalSheetSolved,
        totalSheetQuestions: summary.totalQuestions,
        completionPercent: summary.userRow.completionPercent,
        easySolved: summary.userRow.easySolved,
        mediumSolved: summary.userRow.mediumSolved,
        hardSolved: summary.userRow.hardSolved,
        score: summary.userRow.score,
      };
      // If the user solved nothing on this sheet now, they drop off the board.
      const rows = summary.userRow.totalSheetSolved > 0 ? [...withoutUser, newRow] : withoutUser;
      return resortEntries(rows);
    });

    // Background reconciliation: refresh affected server components (navbar,
    // dashboard cards; other tabs) without blocking the interaction.
    router.refresh();
  };

  const docSheetMatches = (sheetIdOrSlug: string, current: SheetProgressSummary | null) =>
    sheetIdOrSlug === current?.sheet.id || sheetIdOrSlug === current?.sheet.slug;

  const currentQuestions = useMemo(() => sheetData?.questions ?? [], [sheetData]);

  const topics = useMemo(
    () => Array.from(new Set(currentQuestions.map((q) => q.topic))).sort(),
    [currentQuestions]
  );

  const filteredQuestions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return currentQuestions.filter((q) => {
      if (
        query &&
        !q.title.toLowerCase().includes(query) &&
        !q.topic.toLowerCase().includes(query) &&
        !String(q.position).includes(query)
      ) {
        return false;
      }
      if (topicFilter !== "ALL" && q.topic !== topicFilter) return false;
      if (difficultyFilter !== "ALL" && q.difficulty !== difficultyFilter) return false;
      if (statusFilter === "SOLVED" && !q.isSolved) return false;
      if (statusFilter === "UNSOLVED" && q.isSolved) return false;
      return true;
    });
  }, [currentQuestions, searchQuery, topicFilter, difficultyFilter, statusFilter]);

  const selectClasses =
    "bg-surface-page border border-outline-subtle text-xs text-content-primary rounded-lg px-3 py-2 focus:outline-none focus:border-brand-primary";

  return (
    <div className="space-y-6">
      {/* Sheet Switcher Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-4 sm:p-6 rounded-2xl border-l-4 border-l-brand-primary">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-content-primary flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-brand-primary flex-shrink-0" aria-hidden />
            <span>Curated DSA Sheets</span>
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1 break-words">
            Questions are auto-ticked from your synced LeetCode submissions — or tick them
            yourself below. Scoring: Easy {sheetData?.sheet.easyPoints ?? 1} · Medium{" "}
            {sheetData?.sheet.mediumPoints ?? 4} · Hard {sheetData?.sheet.hardPoints ?? 8} pts.
          </p>
        </div>

        {/* Sheet Selector Dropdown */}
        {initialSheets.length > 0 && (
          <select
            value={sheetData?.sheet.slug ?? initialSheets[0].slug}
            onChange={(e) => router.push(`/sheets/${e.target.value}`)}
            aria-label="Switch sheet"
            className="bg-surface-page border border-outline-subtle text-sm text-content-primary font-bold rounded-xl px-4 py-2.5 max-w-full focus:outline-none focus:border-brand-primary cursor-pointer"
          >
            {initialSheets.map((sheet) => (
              <option key={sheet.id} value={sheet.slug}>
                {sheet.name} ({sheet.totalQuestions})
              </option>
            ))}
          </select>
        )}
      </div>

      {sheetData && (
        <>
          {/* Active Sheet Progress Stats Banner (live, optimistic) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 relative">
            {[
              { label: "Total Problems", value: sheetData.totalQuestions, valueClasses: "text-content-primary" },
              { label: "Your Solved", value: sheetData.solvedQuestions, valueClasses: "text-status-success" },
              { label: "Remaining", value: sheetData.remainingQuestions, valueClasses: "text-brand-accent" },
              { label: "Completion", value: `${sheetData.completionPercent}%`, valueClasses: "text-brand-accent" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-3 sm:p-4 rounded-xl">
                <p className="text-[11px] text-content-muted font-semibold uppercase">{stat.label}</p>
                <h3 className={`text-xl font-black mt-1 ${stat.valueClasses}`}>{stat.value}</h3>
              </div>
            ))}
            {refreshing && (
              <div className="absolute -top-5 right-0 flex items-center gap-1.5 text-[10px] text-content-muted">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                <span>updating…</span>
              </div>
            )}
            {refreshStale && (
              <p className="absolute -top-5 left-0 text-[10px] text-brand-accent">
                Some sections may lag a moment; totals above are already saved.
              </p>
            )}
          </div>

          {/* Sub-tabs: Questions vs Leaderboard */}
          <div className="flex items-center gap-2 border-b border-outline-subtle pb-2 overflow-x-auto">
            {([["questions", `Questions Table (${currentQuestions.length})`, false], ["leaderboard", "Sheet Leaderboard", true]] as const).map(
              ([tab, label, isTrophy]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 ${
                    activeTab === tab
                      ? "bg-surface-elevated text-content-primary border border-outline-subtle"
                      : "text-content-muted hover:text-content-primary"
                  }`}
                >
                  {isTrophy ? (
                    <Trophy className="w-3.5 h-3.5 text-brand-accent" aria-hidden />
                  ) : (
                    <BookMarked className="w-3.5 h-3.5" aria-hidden />
                  )}
                  <span>{label}</span>
                </button>
              )
            )}
          </div>

          {activeTab === "questions" ? (
            <>
              {/* Search & Filter Toolbar */}
              <div className="glass-card p-3 sm:p-4 rounded-xl flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" aria-hidden />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search problem title or position..."
                    aria-label="Search problems"
                    className="w-full bg-surface-page border border-outline-subtle rounded-lg pl-9 pr-3 py-2 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:border-brand-primary transition"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className={`${selectClasses} flex-1 md:flex-none min-w-0`} aria-label="Filter by topic">
                    <option value="ALL">All Topics</option>
                    {topics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                  <select
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value)}
                    className={`${selectClasses} flex-1 md:flex-none`}
                    aria-label="Filter by difficulty"
                  >
                    <option value="ALL">All Difficulties</option>
                    {difficulties.map((d) => (
                      <option key={d} value={d}>
                        {d.charAt(0) + d.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={`${selectClasses} flex-1 md:flex-none`}
                    aria-label="Filter by status"
                  >
                    <option value="ALL">All Status</option>
                    <option value="SOLVED">Solved</option>
                    <option value="UNSOLVED">Unsolved</option>
                  </select>
                </div>
              </div>

              <QuestionsTable
                questions={filteredQuestions}
                scoring={{
                  easyPoints: sheetData.sheet.easyPoints,
                  mediumPoints: sheetData.sheet.mediumPoints,
                  hardPoints: sheetData.sheet.hardPoints,
                }}
                onSettled={updateFromMutation}
              />
            </>
          ) : (
            <SheetStandings
              sheetName={sheetData.sheet.name}
              rows={standings}
              scoring={{
                easyPoints: sheetData.sheet.easyPoints,
                mediumPoints: sheetData.sheet.mediumPoints,
                hardPoints: sheetData.sheet.hardPoints,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
