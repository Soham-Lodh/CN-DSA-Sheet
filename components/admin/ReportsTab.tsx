"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import type { AdminSheet } from "./types";

type ReportScope = "global" | "sheet";

interface ReportRow {
  rollNumber: string;
  name: string;
  email: string;
  leetcodeUsername: string;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
}

interface GlobalReport {
  generatedAt: string;
  totalStudents: number;
  linkedStudents: number;
  rows: ReportRow[];
}

interface SheetReport {
  generatedAt: string;
  sheet: { id: string; name: string; slug: string };
  totalQuestions: number;
  totalStudents: number;
  rows: ReportRow[];
}

/**
 * Admin reports: the global roster report (LeetCode totals for every student)
 * and the per-sheet report (each student's solved easy/medium/hard inside that
 * sheet). Both preview in the table and download as .xlsx.
 */
export function ReportsTab({ sheets }: { sheets: AdminSheet[] }) {
  const [scope, setScope] = useState<ReportScope>("global");
  const [sheetId, setSheetId] = useState(sheets[0]?.id ?? "");
  const [report, setReport] = useState<GlobalReport | SheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextScope: ReportScope, nextSheetId: string) => {
    if (nextScope === "sheet" && !nextSheetId) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url =
        nextScope === "global"
          ? "/api/admin/reports/global"
          : `/api/admin/reports/sheets/${nextSheetId}`;
      const res = await fetch(url, { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          typeof payload?.error === "string" ? payload.error : payload?.error?.message;
        throw new Error(message || "Could not load the report.");
      }
      setReport(payload as GlobalReport | SheetReport);
    } catch (err: any) {
      setError(err?.message || "Could not load the report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(scope, sheetId);
  }, [scope, sheetId, load]);

  const rows = report?.rows ?? [];
  const generatedAt = report ? new Date(report.generatedAt) : null;
  const exportHref =
    scope === "global"
      ? "/api/admin/reports/global?format=xlsx"
      : `/api/admin/reports/sheets/${sheetId}?format=xlsx`;
  const canDownload = Boolean(report) && (scope === "global" || Boolean(sheetId));

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 border border-outline-subtle">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-content-primary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-brand-primary" />
            <span>Student reports</span>
          </h3>
          <p className="text-[11px] text-content-muted mt-1">
            Roll number, name, email, LeetCode username and easy/medium/hard counts — globally, or
            for one sheet according to that sheet&apos;s questions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-outline-subtle">
            <button
              type="button"
              onClick={() => setScope("global")}
              className={`px-3 py-2 text-xs font-bold transition ${
                scope === "global"
                  ? "bg-brand-primary text-content-primary"
                  : "bg-surface-elevated text-content-muted hover:text-content-primary"
              }`}
            >
              Global report
            </button>
            <button
              type="button"
              onClick={() => setScope("sheet")}
              className={`px-3 py-2 text-xs font-bold transition ${
                scope === "sheet"
                  ? "bg-brand-primary text-content-primary"
                  : "bg-surface-elevated text-content-muted hover:text-content-primary"
              }`}
            >
              Sheet report
            </button>
          </div>

          {scope === "sheet" && (
            <select
              value={sheetId}
              onChange={(event) => setSheetId(event.target.value)}
              className="bg-surface-page border border-outline-subtle text-xs text-content-primary rounded-lg px-3 py-2"
            >
              {sheets.length === 0 && <option value="">No sheets yet</option>}
              {sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>
                  {sheet.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => load(scope, sheetId)}
            disabled={loading}
            title="Reload report"
            className="p-2 rounded-lg bg-surface-elevated hover:bg-outline-subtle text-content-secondary transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <a
            href={canDownload ? exportHref : undefined}
            aria-disabled={!canDownload}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              canDownload
                ? "bg-brand-primary hover:bg-brand-hover text-content-primary"
                : "bg-surface-elevated text-content-muted pointer-events-none opacity-60"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="py-10 flex items-center justify-center text-xs text-content-muted gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading report…</span>
        </div>
      )}

      {report && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-content-muted">
            <span>
              {report.totalStudents} students
              {generatedAt ? ` · generated ${generatedAt.toLocaleString("en-IN")}` : ""}
              {"sheet" in report ? ` · ${report.totalQuestions} questions in this sheet` : ""}
            </span>
            <span className="font-mono">
              {"sheet" in report ? report.sheet.slug : "all sheets"}
            </span>
          </div>

          <div className="overflow-x-auto max-h-[28rem] rounded-xl border border-outline-subtle">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead className="sticky top-0 bg-surface-elevated text-content-muted uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">LeetCode</th>
                  <th className="py-3 px-4 text-right">Easy</th>
                  <th className="py-3 px-4 text-right">Medium</th>
                  <th className="py-3 px-4 text-right">Hard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-subtle">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-content-muted">
                      No students to report yet.
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => (
                  <tr key={`${row.email}-${index}`} className="hover:bg-surface-elevated/60">
                    <td className="py-2.5 px-4 font-mono text-content-secondary">
                      {row.rollNumber || "—"}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-content-primary">{row.name}</td>
                    <td className="py-2.5 px-4 text-content-muted break-all">{row.email}</td>
                    <td className="py-2.5 px-4 text-content-secondary">
                      {row.leetcodeUsername || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-400 font-mono">
                      {row.easySolved}
                    </td>
                    <td className="py-2.5 px-4 text-right text-amber-400 font-mono">
                      {row.mediumSolved}
                    </td>
                    <td className="py-2.5 px-4 text-right text-rose-400 font-mono">
                      {row.hardSolved}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
