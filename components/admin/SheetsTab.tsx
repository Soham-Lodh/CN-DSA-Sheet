import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import type { AdminSheet } from "./types";
import { SheetStatus } from "@prisma/client";

interface SheetsTabProps {
  sheets: AdminSheet[];
  onCreateSheet: () => void;
  onEditSheet: (sheet: AdminSheet) => void;
  onDeleteSheet: (sheet: AdminSheet) => void;
  onToggleStatus: (sheetId: string, currentStatus: SheetStatus) => void;
}

/** Sheets management tab: edit/delete/publish toggles and links to live sheets. */
export function SheetsTab({
  sheets,
  onCreateSheet,
  onEditSheet,
  onDeleteSheet,
  onToggleStatus,
}: SheetsTabProps) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 border border-slate-800">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm text-white">DSA Sheets Management</h3>
        <button
          onClick={onCreateSheet}
          className="px-4 py-2 bg-cnOrange-600 hover:bg-cnOrange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Sheet</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sheets.map((s) => (
          <div
            key={s.id}
            className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base text-white">{s.name}</h4>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  s.status === "PUBLISHED"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {s.status}
              </span>
            </div>

            <p className="text-xs text-slate-400">{s.description || "No description provided."}</p>

            <div className="flex justify-between text-xs text-slate-400 font-mono pt-2 border-t border-slate-800">
              <span>Slug: /{s.slug}</span>
              <span>Questions: {s._count?.sheetQuestions ?? 0}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleStatus(s.id, s.status)}
                  className="text-xs text-cnOrange-400 hover:underline font-bold"
                >
                  {s.status === "PUBLISHED" ? "Archive Sheet" : "Publish Sheet"}
                </button>
                <a
                  href={`/sheets/${s.slug}`}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <span>View Sheet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditSheet(s)}
                  title="Edit sheet name/description"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteSheet(s)}
                  title="Delete sheet permanently"
                  className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
