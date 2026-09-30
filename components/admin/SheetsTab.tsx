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
    <div className="glass-card rounded-2xl p-5 space-y-4 border border-outline-subtle">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm text-content-primary">DSA Sheets Management</h3>
        <button
          onClick={onCreateSheet}
          className="px-4 py-2 bg-brand-primary hover:bg-brand-hover text-content-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Sheet</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sheets.map((s) => (
          <div
            key={s.id}
            className="p-5 rounded-xl bg-surface-page/80 border border-outline-subtle space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base text-content-primary">{s.name}</h4>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  s.status === "PUBLISHED"
                    ? "bg-status-success/20 text-status-success"
                    : "bg-outline-subtle text-content-secondary"
                }`}
              >
                {s.status}
              </span>
            </div>

            <p className="text-xs text-content-muted">{s.description || "No description provided."}</p>

            <div className="flex justify-between text-xs text-content-muted font-mono pt-2 border-t border-outline-subtle">
              <span>Slug: /{s.slug}</span>
              <span>Questions: {s._count?.sheetQuestions ?? 0}</span>
            </div>

            <p className="text-[10px] text-content-muted font-mono">
              Points — Easy {s.easyPoints} · Medium {s.mediumPoints} · Hard {s.hardPoints}
            </p>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleStatus(s.id, s.status)}
                  className="text-xs text-brand-accent hover:underline font-bold"
                >
                  {s.status === "PUBLISHED" ? "Archive Sheet" : "Publish Sheet"}
                </button>
                <a
                  href={`/sheets/${s.slug}`}
                  className="text-xs text-content-muted hover:text-content-primary flex items-center gap-1"
                >
                  <span>View Sheet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditSheet(s)}
                  title="Edit sheet name/description/scoring"
                  className="p-1.5 rounded-lg bg-surface-elevated hover:bg-outline-subtle text-content-secondary transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteSheet(s)}
                  title="Delete sheet permanently"
                  className="p-1.5 rounded-lg bg-status-danger/20 hover:bg-status-danger/40 text-status-danger transition"
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
