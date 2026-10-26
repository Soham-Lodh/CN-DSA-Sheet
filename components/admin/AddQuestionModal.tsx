"use client";

import { Plus } from "lucide-react";
import type { Difficulty } from "@prisma/client";
import type { AdminSheet } from "./types";

export interface ParsedProblem {
  externalKey: string;
  normalizedUrl: string;
  title: string;
  difficulty?: string;
  topic?: string;
  tags?: string[];
}

interface AddQuestionModalProps {
  sheets: AdminSheet[];
  problemUrl: string;
  parsingUrl: boolean;
  parsedData: ParsedProblem | null;
  selectedSheetId: string;
  customTitle: string;
  customTopic: string;
  customDifficulty: Difficulty;
  modalError: string | null;
  savingQuestion: boolean;
  onProblemUrlChange: (value: string) => void;
  onParseUrl: () => void;
  onSelectedSheetChange: (value: string) => void;
  onCustomTitleChange: (value: string) => void;
  onCustomTopicChange: (value: string) => void;
  onCustomDifficultyChange: (value: Difficulty) => void;
  onSave: () => void;
  onClose: () => void;
}

const inputClasses =
  "w-full bg-surface-page border border-outline-subtle rounded-lg p-2.5 text-content-primary focus:outline-none focus:border-brand-primary";

/** Modal to add a LeetCode DSA question by parsing its URL. */
export function AddQuestionModal({
  sheets,
  problemUrl,
  parsingUrl,
  parsedData,
  selectedSheetId,
  customTitle,
  customTopic,
  customDifficulty,
  modalError,
  savingQuestion,
  onProblemUrlChange,
  onParseUrl,
  onSelectedSheetChange,
  onCustomTitleChange,
  onCustomTopicChange,
  onCustomDifficultyChange,
  onSave,
  onClose,
}: AddQuestionModalProps) {
  return (
    <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 rounded-2xl max-w-lg w-full border border-outline-subtle space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-content-primary text-base flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand-primary" />
            <span>Add LeetCode Question to Sheet</span>
          </h3>
          <button type="button" onClick={onClose} className="text-content-muted hover:text-content-primary">
            ✕
          </button>
        </div>

        {modalError && (
          <div className="p-3 bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs rounded-xl">
            {modalError}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-content-muted font-semibold mb-1">LeetCode Problem URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={problemUrl}
                onChange={(e) => onProblemUrlChange(e.target.value)}
                placeholder="https://leetcode.com/problems/two-sum/"
                className={`${inputClasses} flex-1`}
              />
              <button
                type="button"
                onClick={onParseUrl}
                disabled={parsingUrl || !problemUrl.trim()}
                className="px-4 py-2 bg-surface-elevated hover:bg-outline-subtle text-content-primary font-bold rounded-lg transition disabled:opacity-50"
              >
                {parsingUrl ? "Parsing..." : "Parse"}
              </button>
            </div>
          </div>

          {parsedData && (
            <div className="p-3 bg-surface-page/80 rounded-xl border border-outline-subtle space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-content-muted">Canonical Key:</span>
                <span className="font-mono text-content-primary">{parsedData.externalKey}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-content-muted font-semibold mb-1">Problem Title</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => onCustomTitleChange(e.target.value)}
              placeholder="e.g. Two Sum"
              className={inputClasses}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-content-muted font-semibold mb-1">Assign to Sheet</label>
              <select
                value={selectedSheetId}
                onChange={(e) => onSelectedSheetChange(e.target.value)}
                className={inputClasses}
              >
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-content-muted font-semibold mb-1">Difficulty</label>
              <select
                value={customDifficulty}
                onChange={(e) => onCustomDifficultyChange(e.target.value as Difficulty)}
                className={inputClasses}
              >
                <option value="EASY">Easy (1 pt)</option>
                <option value="MEDIUM">Medium (4 pts)</option>
                <option value="HARD">Hard (8 pts)</option>
                <option value="UNKNOWN">Unknown (0 pts)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-content-muted font-semibold mb-1">Topic / Category</label>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => onCustomTopicChange(e.target.value)}
              placeholder="e.g. Arrays, Dynamic Programming, Graphs"
              className={inputClasses}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-elevated hover:bg-outline-subtle text-content-secondary font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={savingQuestion}
              className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-content-primary font-bold rounded-xl disabled:opacity-50"
            >
              {savingQuestion ? "Saving..." : "Save Question"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
