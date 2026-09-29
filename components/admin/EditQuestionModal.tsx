"use client";

import type { AdminSheetQuestion } from "./types";
import { Difficulty } from "@prisma/client";

interface EditQuestionModalProps {
  sheetQuestion: AdminSheetQuestion;
  title: string;
  topic: string;
  difficulty: Difficulty;
  position: number;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onTopicChange: (value: string) => void;
  onDifficultyChange: (value: Difficulty) => void;
  onPositionChange: (value: number) => void;
  onSave: () => void;
  onClose: () => void;
}

const inputClasses = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white";

/** Modal to edit an existing sheet question (title/topic/difficulty/position). */
export function EditQuestionModal({
  sheetQuestion,
  title,
  topic,
  difficulty,
  position,
  saving,
  onTitleChange,
  onTopicChange,
  onDifficultyChange,
  onPositionChange,
  onSave,
  onClose,
}: EditQuestionModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 rounded-2xl max-w-lg w-full border border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-white text-base">Edit Question</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <p className="text-[11px] text-slate-500 font-mono break-all">
          {sheetQuestion.question.externalKey} · {sheetQuestion.sheet?.name}
        </p>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Problem Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => onDifficultyChange(e.target.value as Difficulty)}
                className={inputClasses}
              >
                <option value="EASY">Easy (1 pt)</option>
                <option value="MEDIUM">Medium (4 pts)</option>
                <option value="HARD">Hard (8 pts)</option>
                <option value="UNKNOWN">Unknown (0 pts)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Position</label>
              <input
                type="number"
                min={0}
                value={position}
                onChange={(e) => onPositionChange(parseInt(e.target.value, 10) || 0)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
                className={inputClasses}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving || !title.trim()}
              className="px-5 py-2 bg-cnOrange-600 hover:bg-cnOrange-700 text-white font-bold rounded-xl disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
