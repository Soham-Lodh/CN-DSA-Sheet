"use client";

import type { ScoringConfig } from "@/lib/scoring/global";

export interface SheetModalValues {
  name: string;
  slug: string;
  description: string;
  easyPoints: number;
  mediumPoints: number;
  hardPoints: number;
}

interface CreateSheetModalProps {
  /** When set, the modal edits an existing sheet instead of creating one. */
  initial?: SheetModalValues | null;
  name: string;
  slug: string;
  description: string;
  easyPoints: number;
  mediumPoints: number;
  hardPoints: number;
  saving: boolean;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPointsChange: (field: keyof ScoringConfig, value: number) => void;
  onCreate: () => void;
  onClose: () => void;
}

const inputClasses = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white";

const pointFields: { field: keyof ScoringConfig; label: string }[] = [
  { field: "easyPoints", label: "Easy Points" },
  { field: "mediumPoints", label: "Medium Points" },
  { field: "hardPoints", label: "Hard Points" },
];

/** Modal to create a new curated DSA sheet (or edit one when `initial` is set). */
export function CreateSheetModal({
  initial,
  name,
  slug,
  description,
  easyPoints,
  mediumPoints,
  hardPoints,
  saving,
  onNameChange,
  onSlugChange,
  onDescriptionChange,
  onPointsChange,
  onCreate,
  onClose,
}: CreateSheetModalProps) {
  const isEdit = Boolean(initial);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 rounded-2xl max-w-lg w-full border border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-white text-base">
            {isEdit ? "Edit DSA Sheet" : "Create Curated DSA Sheet"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Sheet Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. KIIT Placement Foundation 75"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">URL Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              placeholder="e.g. kiit-placement-75"
              disabled={isEdit}
              className={`${inputClasses} font-mono disabled:opacity-60`}
            />
            {isEdit && (
              <p className="text-[10px] text-slate-500 mt-1">
                Slug is fixed after creation (it is the sheet's public URL).
              </p>
            )}
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Brief summary of topics and targets..."
              className={`${inputClasses} h-20`}
            />
          </div>

          {/* Per-sheet scoring configuration */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Scoring Points (per solved question)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {pointFields.map(({ field, label }) => {
                const value =
                  field === "easyPoints" ? easyPoints : field === "mediumPoints" ? mediumPoints : hardPoints;
                return (
                  <div key={field}>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wide">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      step={1}
                      value={value}
                      onChange={(e) => onPointsChange(field, Number(e.target.value))}
                      className={`${inputClasses} font-mono`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Defaults follow the global scheme: Easy 1 · Medium 4 · Hard 8 pts.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={onCreate}
              disabled={saving || !name || (!isEdit && !slug)}
              className="px-5 py-2 bg-cnOrange-600 hover:bg-cnOrange-700 text-white font-bold rounded-xl disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Sheet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
