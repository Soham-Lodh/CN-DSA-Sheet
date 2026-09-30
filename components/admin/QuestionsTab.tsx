"use client";

import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { AdminSheet, AdminSheetQuestion } from "./types";
import { difficultyClasses } from "@/lib/utils";

interface QuestionsTabProps {
  sheets: AdminSheet[];
  questions: AdminSheetQuestion[];
  filterSheetId: string;
  onFilterSheetChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onAddQuestion: () => void;
  onEditQuestion: (sq: AdminSheetQuestion) => void;
  onRemoveQuestion: (sheetQuestionId: string) => void;
}

/** Questions database management tab with sheet filter, search and edit/remove actions. */
export function QuestionsTab({
  sheets,
  questions,
  filterSheetId,
  onFilterSheetChange,
  search,
  onSearchChange,
  onAddQuestion,
  onEditQuestion,
  onRemoveQuestion,
}: QuestionsTabProps) {
  const filtered = questions.filter((q) => {
    if (filterSheetId !== "ALL" && q.sheetId !== filterSheetId) return false;
    if (!search) return true;
    const qs = search.toLowerCase();
    return (
      q.question.title.toLowerCase().includes(qs) ||
      q.question.topic.toLowerCase().includes(qs) ||
      q.question.externalKey.toLowerCase().includes(qs)
    );
  });

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 border border-outline-subtle">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <select
            value={filterSheetId}
            onChange={(e) => onFilterSheetChange(e.target.value)}
            className="bg-surface-page border border-outline-subtle text-xs text-content-primary rounded-lg px-3 py-2"
          >
            <option value="ALL">All Sheets</option>
            {sheets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter by title / topic..."
              className="w-full bg-surface-page border border-outline-subtle rounded-lg pl-9 pr-3 py-1.5 text-xs text-content-primary placeholder-content-muted"
            />
          </div>
        </div>

        <button
          onClick={onAddQuestion}
          className="px-4 py-2 bg-brand-primary hover:bg-brand-hover text-content-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Question</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-elevated text-content-muted uppercase font-semibold">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">Problem Title</th>
              <th className="py-3 px-4">Sheet</th>
              <th className="py-3 px-4">Topic</th>
              <th className="py-3 px-4">Difficulty</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-subtle">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-content-muted">
                  No questions found in this sheet.
                </td>
              </tr>
            ) : (
              filtered.map((sq) => (
                <tr key={sq.id} className="hover:bg-surface-elevated/60">
                  <td className="py-3 px-4 text-center font-mono text-content-muted">{sq.position}</td>
                  <td className="py-3 px-4">
                    <a
                      href={sq.question.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-content-primary hover:text-brand-accent flex items-center gap-1.5"
                    >
                      <span>{sq.question.title}</span>
                      <ExternalLink className="w-3 h-3 text-content-muted" />
                    </a>
                    <span className="text-[10px] font-mono text-content-muted">
                      {sq.question.externalKey}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-content-secondary">
                    <span className="bg-surface-elevated px-2 py-0.5 rounded text-[10px]">
                      {sq.sheet?.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-content-muted">{sq.question.topic}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        difficultyClasses[sq.question.difficulty] ?? difficultyClasses.UNKNOWN
                      }`}
                    >
                      {sq.question.difficulty}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEditQuestion(sq)}
                      title="Edit title/topic/difficulty"
                      className="p-1.5 rounded-lg bg-surface-elevated hover:bg-outline-subtle text-content-secondary transition mr-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemoveQuestion(sq.id)}
                      title="Remove from sheet"
                      className="p-1.5 rounded-lg bg-status-danger/20 hover:bg-status-danger/40 text-status-danger transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
