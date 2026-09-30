"use client";

import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { PlatformAccount, PlatformSnapshot } from "@prisma/client";
import { formatUtcTime } from "@/lib/formatters/date";

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
    <div className="glass-card p-5 rounded-2xl space-y-4 border border-outline-subtle">
      <div className="flex items-center justify-between">
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold border border-brand-accent/40 text-brand-accent bg-brand-accent/10">
          LeetCode
        </span>
        {account ? (
          <span className="text-[10px] text-status-success flex items-center gap-1 font-bold">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="text-[10px] text-content-muted">Not connected</span>
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
          <p className="text-xs text-content-muted mb-3">
            Connect your LeetCode profile to include your accepted submissions in your KIIT ranking.
          </p>
          <button
            onClick={onStartConnect}
            className="w-full py-2 rounded-xl bg-surface-elevated hover:bg-outline-subtle text-content-primary font-bold text-xs border border-outline-subtle flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-3.5 h-3.5 text-brand-primary" />
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
        <span className="text-sm font-black text-content-primary font-mono">{account.username}</span>
        <button
          onClick={onDisconnect}
          className="text-content-muted hover:text-status-danger text-xs transition"
          title="Disconnect account"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {account.lastError && (
        <p className="text-[10px] text-status-danger">Sync error: {account.lastError}</p>
      )}

      <div className="bg-surface-page/80 p-3 rounded-xl border border-outline-subtle space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-content-muted">Total Solved:</span>
          <strong className="text-content-primary">{snapshot?.totalSolved ?? 0}</strong>
        </div>
        {snapshot && (
          <div className="flex justify-between text-[11px]">
            <span className="text-content-muted">E / M / H:</span>
            <span>
              <span className="text-status-success">{snapshot.easySolved}</span> /{" "}
              <span className="text-brand-accent">{snapshot.mediumSolved}</span> /{" "}
              <span className="text-status-danger">{snapshot.hardSolved}</span>
            </span>
          </div>
        )}
        {(snapshot?.rating || snapshot?.rank) && (
          <div className="flex justify-between text-[11px]">
            <span className="text-content-muted">Contest Rating:</span>
            <span className="text-brand-accent font-mono">{snapshot.rating ?? snapshot.rank}</span>
          </div>
        )}
        <div className="text-[10px] text-content-muted pt-1 border-t border-outline-subtle">
          Last sync (UTC):{" "}
          {account.lastSuccessfulSyncAt
            ? formatUtcTime(account.lastSuccessfulSyncAt)
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
        className="w-full bg-surface-page border border-outline-subtle rounded-lg p-2 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:border-brand-primary"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button
          onClick={onConnect}
          disabled={syncing || !handleInput.trim()}
          className="flex-1 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-hover text-content-primary font-bold text-xs transition disabled:opacity-50"
        >
          {syncing ? "Verifying..." : "Save & Sync"}
        </button>
        <button
          onClick={onCancelConnect}
          className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-outline-subtle text-content-secondary text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
