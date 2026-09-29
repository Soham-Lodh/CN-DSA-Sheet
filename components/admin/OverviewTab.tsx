"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AdminOverview, AdminSyncLog } from "./types";

interface OverviewTabProps {
  overview: AdminOverview;
  syncLogs: AdminSyncLog[];
  syncingAll: boolean;
  onSystemSync: () => void;
}

/** Overview metrics tab: student/platform counts, system sync trigger and recent sync logs. */
export function OverviewTab({ overview, syncLogs, onSystemSync }: OverviewTabProps) {
  const [syncing, setSyncing] = useState(false);

  const metrics = [
    { label: "Total KIIT Students", value: String(overview.totalUsers), valueClasses: "text-white" },
    {
      label: "Published Sheets",
      value: `${overview.publishedSheets} / ${overview.totalSheets}`,
      valueClasses: "text-cnOrange-400",
    },
    { label: "Canonical Questions", value: String(overview.totalQuestions), valueClasses: "text-amber-400" },
    {
      label: "Verified Solved Records",
      value: String(overview.totalSolvedRecords),
      valueClasses: "text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="glass-card p-5 rounded-2xl">
            <p className="text-xs text-slate-400 font-semibold uppercase">{metric.label}</p>
            <h3 className={`text-2xl font-black mt-1 ${metric.valueClasses}`}>{metric.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl space-y-3">
          <h3 className="font-bold text-sm text-white">Connected Accounts</h3>
          <div className="flex justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
            <span className="text-slate-400">LeetCode Accounts:</span>
            <strong className="font-mono text-amber-400">{overview.leetcodeAccounts}</strong>
          </div>
          {overview.recentFailedSyncs > 0 && (
            <p className="text-[11px] text-rose-400">
              {overview.recentFailedSyncs} failed sync{overview.recentFailedSyncs === 1 ? "" : "s"} on record
            </p>
          )}

          <button
            onClick={() => {
              setSyncing(true);
              Promise.resolve(onSystemSync()).finally(() => setSyncing(false));
            }}
            disabled={syncing}
            className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cnOrange-500 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing System..." : "Trigger System-wide Sync"}</span>
          </button>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-3 lg:col-span-2">
          <h3 className="font-bold text-sm text-white">Recent Platform Synchronization Logs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Problems Processed</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {syncLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      No recent sync activity recorded.
                    </td>
                  </tr>
                ) : (
                  syncLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/60">
                      <td className="py-2.5 px-3 text-white font-medium">{log.user?.name}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : log.status === "RUNNING"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{log.recordsProcessed}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono text-[10px]">
                        {new Date(log.startedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
