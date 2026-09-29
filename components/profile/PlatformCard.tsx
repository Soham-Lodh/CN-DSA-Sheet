"use client";

import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { PlatformAccount, PlatformSnapshot } from "@prisma/client";

interface PlatformCardProps {
  account?: PlatformAccount;
  snapshot?: PlatformSnapshot;
  isConnecting: boolean;
  syncing: boolean;
  handleInput: string;
  onHandleInputChange: (value: string) => void;
  onConnect: () => void;
  onStartConnect: () => void;
  onCancelConnect: () => void;
  onDisconnect: () => void;
}

/** Connect / stats / disconnect card for the user's LeetCode account. */
export function PlatformCard({
  account,
  snapshot,
  isConnecting,
  syncing,
  handleInput,
  onHandleInputChange,
  onConnect,
  onStartConnect,
  onCancelConnect,
  onDisconnect,
}: PlatformCardProps) {
  return (
    <div className="glass-card p-5 rounded-2xl space-y-4 border border-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-500/40 text-amber-400 bg-amber-500/10">
          LeetCode
        </span>
        {account ? (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">Not connected</span>
        )}
      </div>

      {account ? (
        <ConnectedBody account={account} snapshot={snapshot} onDisconnect={onDisconnect} />
      ) : isConnecting ? (
        <ConnectForm
          syncing={syncing}
          handleInput={handleInput}
          onHandleInputChange={onHandleInputChange}
          onConnect={onConnect}
          onCancelConnect={onCancelConnect}
        />
      ) : (
        <div>
          <p className="text-xs text-slate-400 mb-3">
            Connect your LeetCode profile to include your accepted submissions in your KIIT ranking.
          </p>
          <button
            onClick={onStartConnect}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-3.5 h-3.5 text-cnOrange-500" />
            <span>Connect LeetCode</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectedBody({
  account,
  snapshot,
  onDisconnect,
}: {
  account: PlatformAccount;
  snapshot?: PlatformSnapshot;
  onDisconnect: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-black text-white font-mono">{account.username}</span>
        <button
          onClick={onDisconnect}
          className="text-slate-500 hover:text-rose-400 text-xs transition"
          title="Disconnect account"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {account.lastError && (
        <p className="text-[10px] text-rose-400">Sync error: {account.lastError}</p>
      )}

      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Total Solved:</span>
          <strong className="text-white">{snapshot?.totalSolved ?? 0}</strong>
        </div>
        {snapshot && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">E / M / H:</span>
            <span>
              <span className="text-emerald-400">{snapshot.easySolved}</span> /{" "}
              <span className="text-amber-400">{snapshot.mediumSolved}</span> /{" "}
              <span className="text-rose-400">{snapshot.hardSolved}</span>
            </span>
          </div>
        )}
        {(snapshot?.rating || snapshot?.rank) && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Contest Rating:</span>
            <span className="text-amber-400 font-mono">{snapshot.rating ?? snapshot.rank}</span>
          </div>
        )}
        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
          Last sync:{" "}
          {account.lastSuccessfulSyncAt
            ? new Date(account.lastSuccessfulSyncAt).toLocaleTimeString()
            : "Never"}
        </div>
      </div>
    </div>
  );
}

function ConnectForm({
  syncing,
  handleInput,
  onHandleInputChange,
  onConnect,
  onCancelConnect,
}: {
  syncing: boolean;
  handleInput: string;
  onHandleInputChange: (value: string) => void;
  onConnect: () => void;
  onCancelConnect: () => void;
}) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={handleInput}
        onChange={(e) => onHandleInputChange(e.target.value)}
        placeholder="Enter your LeetCode username..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cnOrange-500"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button
          onClick={onConnect}
          disabled={syncing || !handleInput.trim()}
          className="flex-1 py-1.5 rounded-lg bg-cnOrange-600 hover:bg-cnOrange-700 text-white font-bold text-xs transition disabled:opacity-50"
        >
          {syncing ? "Verifying..." : "Save & Sync"}
        </button>
        <button
          onClick={onCancelConnect}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
