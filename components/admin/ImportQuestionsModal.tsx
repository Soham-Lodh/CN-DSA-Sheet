"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import type { AdminSheet } from "./types";

export type ImportRowStatus = "IMPORTED" | "DUPLICATE" | "REJECTED" | "FAILED";

export interface ImportOutcomeRow {
  rowNumber: number;
  status: ImportRowStatus;
  serial: number | null;
  leetcodeNumber: number | null;
  title: string;
  slug: string | null;
  url: string | null;
  difficulty: string | null;
  position: number | null;
  reason: string | null;
  warning: string | null;
}

export interface ImportSummary {
  sheet: { id: string; name: string; slug: string };
  fileName: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  rejected: number;
  failed: number;
  notImported: number;
  ignoredRows: number;
  durationMs: number;
  rows: ImportOutcomeRow[];
}

interface ImportQuestionsModalProps {
  sheets: AdminSheet[];
  initialSheetId: string;
  onClose: () => void;
  onImported: () => void;
}

const statusClasses: Record<ImportRowStatus, string> = {
  IMPORTED: "bg-status-success/15 text-status-success border-status-success/30",
  DUPLICATE: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  REJECTED: "bg-status-danger/10 text-status-danger border-status-danger/30",
  FAILED: "bg-status-danger/10 text-status-danger border-status-danger/30",
};

const statusLabels: Record<ImportRowStatus, string> = {
  IMPORTED: "Added",
  DUPLICATE: "Duplicate",
  REJECTED: "Rejected",
  FAILED: "Failed",
};

const inputClasses =
  "w-full bg-surface-page border border-outline-subtle rounded-lg p-2.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary";

/**
 * Bulk question import (admin): pick a sheet + spreadsheet, then review the
 * confirmation panel — how many questions were added, how many were not, and
 * the per-row reason for every row that could not be pushed.
 */
export function ImportQuestionsModal({
  sheets,
  initialSheetId,
  onClose,
  onImported,
}: ImportQuestionsModalProps) {
  const [sheetId, setSheetId] = useState(initialSheetId || sheets[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);

  const errorMessage = (payload: unknown, fallback: string) => {
    const data = payload as { error?: string | { message?: string } } | null;
    if (!data?.error) return fallback;
    return typeof data.error === "string" ? data.error : (data.error.message ?? fallback);
  };

  const submit = async () => {
    if (!sheetId) {
      setError("Select the sheet these questions belong to.");
      return;
    }
    if (!file) {
      setError("Choose an .xlsx or .csv file first.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/sheets/${sheetId}/import-questions`, {
        method: "POST",
        body: form,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(payload, "Import failed. Try again."));
      setSummary(payload as ImportSummary);
      setOnlyIssues(false);
      onImported();
    } catch (err: any) {
      setError(err?.message || "Import failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setSummary(null);
    setFile(null);
    setError(null);
    setOnlyIssues(false);
  };

  const visibleRows = summary
    ? summary.rows.filter((row) => (onlyIssues ? row.status !== "IMPORTED" : true))
    : [];

  return (
    <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card p-5 sm:p-6 rounded-2xl max-w-3xl w-full border border-outline-subtle space-y-4 my-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-extrabold text-content-primary text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-primary" />
            <span>{summary ? "Bulk import result" : "Add questions from Excel"}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-content-muted hover:text-content-primary p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs rounded-xl">
            {error}
          </div>
        )}

        {!summary && (
          <>
            <p className="text-xs text-content-muted leading-relaxed">
              Upload the sheet&apos;s spreadsheet to add questions in bulk. Every row is checked
              individually: questions already in <span className="text-content-primary">this</span>{" "}
              sheet are skipped, invalid rows are reported with a reason, and the rest are added.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-content-muted font-semibold mb-1">Target sheet</label>
                <select
                  value={sheetId}
                  onChange={(event) => setSheetId(event.target.value)}
                  className={inputClasses}
                >
                  {sheets.length === 0 && <option value="">No sheets yet</option>}
                  {sheets.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-content-muted font-semibold mb-1">
                  Spreadsheet (.xlsx or .csv)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError(null);
                  }}
                  className={`${inputClasses} file:mr-3 file:rounded-md file:border-0 file:bg-surface-elevated file:text-content-primary file:text-xs file:px-3 file:py-1.5`}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-page/80 border border-outline-subtle text-[11px] text-content-muted space-y-1.5">
              <p className="font-semibold text-content-secondary">Expected columns (first row is the header)</p>
              <p>
                <span className="text-content-primary">Question Name</span> + either{" "}
                <span className="text-content-primary">LeetCode Link</span> or{" "}
                <span className="text-content-primary">Slug</span> — required.
              </p>
              <p>
                <span className="text-content-primary">S.No / Serial</span> (spreadsheet order),{" "}
                <span className="text-content-primary">LeetCode Question Number</span>,{" "}
                <span className="text-content-primary">Topic</span> and{" "}
                <span className="text-content-primary">Difficulty</span> (Easy/Medium/Hard) are
                optional. Without a difficulty column the difficulty is fetched from LeetCode.
              </p>
            </div>

            <div className="pt-1 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-surface-elevated hover:bg-outline-subtle text-content-secondary font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={uploading || !file || !sheetId}
                className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-content-primary font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? "Importing..." : "Import questions"}</span>
              </button>
            </div>
          </>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-3 rounded-xl bg-status-success/10 border border-status-success/30">
                <p className="text-xl font-black text-status-success">{summary.imported}</p>
                <p className="text-[10px] uppercase tracking-wide text-content-muted">Added</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-xl font-black text-amber-400">{summary.notImported}</p>
                <p className="text-[10px] uppercase tracking-wide text-content-muted">Not added</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-page/80 border border-outline-subtle">
                <p className="text-xl font-black text-content-primary">{summary.totalRows}</p>
                <p className="text-[10px] uppercase tracking-wide text-content-muted">Rows read</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-page/80 border border-outline-subtle">
                <p className="text-xl font-black text-content-primary">
                  {summary.rows.filter((row) => row.warning).length}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-content-muted">Warnings</p>
              </div>
            </div>

            <div className="text-xs text-content-secondary space-y-1">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                <span>
                  Added {summary.imported} of {summary.totalRows} rows to{" "}
                  <span className="text-content-primary font-semibold">{summary.sheet.name}</span>
                </span>
              </p>
              {summary.notImported > 0 && (
                <p className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Skipped {summary.duplicates} duplicate(s), rejected {summary.rejected} invalid
                    row(s), {summary.failed} failed — details below.
                  </span>
                </p>
              )}
              <p className="text-[10px] text-content-muted font-mono">
                {summary.fileName}
                {summary.ignoredRows > 0 ? ` · ${summary.ignoredRows} blank row(s) ignored` : ""} ·{" "}
                {(summary.durationMs / 1000).toFixed(1)}s
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[11px] text-content-muted">
                <input
                  type="checkbox"
                  checked={onlyIssues}
                  onChange={(event) => setOnlyIssues(event.target.checked)}
                  className="accent-brand-primary"
                />
                Show only rows that were not added
              </label>
              <span className="text-[10px] text-content-muted">Sheet row = spreadsheet row</span>
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-outline-subtle">
              <table className="w-full text-left text-[11px] min-w-[620px]">
                <thead className="sticky top-0 bg-surface-elevated text-content-muted uppercase">
                  <tr>
                    <th className="py-2 px-3 w-14">Row</th>
                    <th className="py-2 px-3">Question</th>
                    <th className="py-2 px-3 w-24">Status</th>
                    <th className="py-2 px-3">Reason / note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-subtle">
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-content-muted">
                        Nothing to show.
                      </td>
                    </tr>
                  )}
                  {visibleRows.map((row) => (
                    <tr key={row.rowNumber} className="align-top">
                      <td className="py-2 px-3 font-mono text-content-muted">{row.rowNumber}</td>
                      <td className="py-2 px-3">
                        <p className="font-semibold text-content-primary">
                          {row.title || "(no name)"}
                        </p>
                        <p className="text-[10px] font-mono text-content-muted break-all">
                          {row.slug ?? row.url ?? "—"}
                        </p>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold ${statusClasses[row.status]}`}
                        >
                          {statusLabels[row.status]}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-content-secondary space-y-0.5">
                        {row.position !== null && (
                          <p className="text-[10px] text-content-muted">
                            Position {row.position}
                            {row.difficulty ? ` · ${row.difficulty}` : ""}
                          </p>
                        )}
                        {row.reason && <p>{row.reason}</p>}
                        {row.warning && (
                          <p className="text-amber-400/90">Warning: {row.warning}</p>
                        )}
                        {!row.reason && !row.warning && row.position === null && <p>—</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 text-xs pt-1">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 bg-surface-elevated hover:bg-outline-subtle text-content-secondary font-bold rounded-xl"
              >
                Import another file
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-content-primary font-bold rounded-xl"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
