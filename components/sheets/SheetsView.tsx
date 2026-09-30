"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SheetProgressSummary } from "@/lib/services/sheets";
import type { SheetLeaderboardEntry } from "@/lib/services/leaderboard";
import { BookMarked, Loader2, Search, Trophy } from "lucide-react";
import { QuestionsTable } from "./QuestionsTable";
import { SheetStandings } from "./SheetStandings";

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

  // Live client state: re-fetched after every manual toggle so the stats banner
  // and leaderboard update instantly, without a full page reload.
  const [sheetData, setSheetData] = useState<SheetProgressSummary | null>(activeSheetData);
  const [standings, setStandings] = useState<SheetLeaderboardEntry[]>(sheetLeaderboard);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAfterToggle = async () => {
    const slug = sheetData?.sheet.slug;
    if (!slug) return;
    setRefreshing(true);
    try {
      const [sheetRes, lbRes] = await Promise.all([
        fetch(`/api/sheets/${slug}`, { cache: "no-store" }),
        fetch(`/api/sheets/${slug}/leaderboard`, { cache: "no-store" }),
      ]);
      if (sheetRes.ok) {
        const data = await sheetRes.json();
        if (data && !data.error) setSheetData(data);
      }
      if (lbRes.ok) {
        const data = await lbRes.json();
        setStandings(data.leaderboard ?? []);
      }
      // Also revalidate the server components (dashboard counts, etc.).
      router.refresh();
    } catch {
      // Optimistic checkbox state still stands; server state will reconcile
      // on the next navigation/refresh.
    } finally {
      setRefreshing(false);
    }
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl border-l-4 border-l-brand-primary">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-content-primary flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-brand-primary" />
            <span>Curated DSA Sheets</span>
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1">
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
            className="bg-surface-page border border-outline-subtle text-sm text-content-primary font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-primary cursor-pointer"
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
          {/* Active Sheet Progress Stats Banner (live) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative">
            {[
              { label: "Total Problems", value: sheetData.totalQuestions, valueClasses: "text-content-primary" },
              { label: "Your Solved", value: sheetData.solvedQuestions, valueClasses: "text-status-success" },
              { label: "Remaining", value: sheetData.remainingQuestions, valueClasses: "text-brand-accent" },
              { label: "Completion", value: `${sheetData.completionPercent}%`, valueClasses: "text-brand-accent" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-4 rounded-xl">
                <p className="text-[11px] text-content-muted font-semibold uppercase">{stat.label}</p>
                <h3 className={`text-xl font-black mt-1 ${stat.valueClasses}`}>{stat.value}</h3>
              </div>
            ))}
            {refreshing && (
              <div className="absolute -top-5 right-0 flex items-center gap-1.5 text-[10px] text-content-muted">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>updating…</span>
              </div>
            )}
          </div>

          {/* Sub-tabs: Questions vs Leaderboard */}
          <div className="flex items-center gap-2 border-b border-outline-subtle pb-2">
            {([["questions", `Questions Table (${currentQuestions.length})`, false], ["leaderboard", "Sheet Leaderboard", true]] as const).map(
              ([tab, label, isTrophy]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === tab
                      ? "bg-surface-elevated text-content-primary border border-outline-subtle"
                      : "text-content-muted hover:text-content-primary"
                  }`}
                >
                  {isTrophy ? (
                    <Trophy className="w-3.5 h-3.5 text-brand-accent" />
                  ) : (
                    <BookMarked className="w-3.5 h-3.5" />
                  )}
                  <span>{label}</span>
                </button>
              )
            )}
          </div>

          {activeTab === "questions" ? (
            <>
              {/* Search & Filter Toolbar */}
              <div className="glass-card p-4 rounded-xl flex flex-col md:flex-row gap-3 justify-between items-center">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search problem title or position..."
                    className="w-full bg-surface-page border border-outline-subtle rounded-lg pl-9 pr-3 py-2 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:border-brand-primary transition"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className={selectClasses}>
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
                    className={selectClasses}
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
                    className={selectClasses}
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
                onToggleComplete={refreshAfterToggle}
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
