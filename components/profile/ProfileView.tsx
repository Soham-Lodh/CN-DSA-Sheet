"use client";

import { useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { PlatformAccount, PlatformSnapshot } from "@prisma/client";
import type { SheetProgressSummary } from "@/lib/services/sheets";
import { PlatformCard } from "./PlatformCard";
import { AchievementsGrid } from "./AchievementsGrid";
import { QuestionsDashboard } from "./QuestionsDashboard";
import { ActivityHeatmap } from "@/components/activity/ActivityHeatmap";
import type { CombinedActivity } from "@/lib/services/activity";
import { UserAvatar } from "@/components/UserAvatar";
import { SCORING_POINTS } from "@/lib/scoring/global";

interface ProfileViewProps {
  profile: {
    id: string;
    email: string;
    name: string;
    rollNumber: string | null;
    avatarUrl: string | null;
    createdAt: Date | string;
    role: "USER" | "ADMIN";
  };
  globalRank: number | null;
  totalSolved: number;
  platformAccount: PlatformAccount | null;
  snapshot: PlatformSnapshot | null;
  sheetProgress: SheetProgressSummary[];
  activity: CombinedActivity;
}

/** Client container for the profile page: LeetCode connect, sync, progress, heatmap. */
export function ProfileView({
  profile,
  globalRank,
  totalSolved,
  platformAccount,
  snapshot,
  sheetProgress,
  activity,
}: ProfileViewProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const request = async (input: RequestInfo, init?: RequestInit, fallbackError = "Request failed") => {
    const res = await fetch(input, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || fallbackError);
    return data;
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await request("/api/sync/me", { method: "POST" }, "Failed to synchronize account");
      setActionSuccess("Successfully refreshed your LeetCode statistics!");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    if (!handleInput.trim()) return;
    setConnecting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await request(
        "/api/profile/platforms",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: handleInput.trim() }),
        },
        "Failed to connect LeetCode account"
      );
      setActionSuccess(`Successfully connected LeetCode account: ${handleInput}!`);
      setConnecting(false);
      setHandleInput("");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to connect LeetCode");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your LeetCode account?")) return;
    setSyncing(true);
    setActionError(null);
    try {
      await request("/api/profile/platforms", { method: "DELETE" }, "Failed to disconnect account");
      setActionSuccess("Disconnected LeetCode account.");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to disconnect");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User Info Header Card */}
      <ProfileHeader
        profile={profile}
        globalRank={globalRank}
        totalSolved={totalSolved}
        connected={Boolean(platformAccount)}
        syncing={syncing}
        onSync={handleManualSync}
      />

      {/* Notifications */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* LeetCode Connection Card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cnOrange-500" />
            <span>Connected Coding Platform</span>
          </h2>
          <span className="text-xs text-slate-400">Syncs every 10+ minutes automatically</span>
        </div>

        <PlatformCard
          account={platformAccount ?? undefined}
          snapshot={snapshot ?? undefined}
          isConnecting={connecting}
          syncing={syncing}
          handleInput={handleInput}
          onHandleInputChange={setHandleInput}
          onConnect={handleConnect}
          onStartConnect={() => {
            setConnecting(true);
            setHandleInput("");
            setActionError(null);
          }}
          onCancelConnect={() => {
            setConnecting(false);
            setHandleInput("");
          }}
          onDisconnect={handleDisconnect}
        />
      </div>

      {/* Combined Activity Heatmap */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-cnOrange-500" />
            <span>Coding Activity (Last 1 Year)</span>
          </h2>
        </div>
        <ActivityHeatmap activity={activity} />
      </div>

      {/* Questions Dashboard: per-sheet auto-derived question status */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cnOrange-500" />
          <span>Questions Dashboard</span>
        </h2>
        <QuestionsDashboard sheets={sheetProgress} />
      </div>

      <AchievementsGrid totalSolved={totalSolved} />
    </div>
  );
}

function ProfileHeader({
  profile,
  globalRank,
  totalSolved,
  connected,
  syncing,
  onSync,
}: {
  profile: ProfileViewProps["profile"];
  globalRank: number | null;
  totalSolved: number;
  connected: boolean;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-6 border-l-4 border-l-cnOrange-500 relative">
      <UserAvatar
        avatarUrl={profile.avatarUrl}
        name={profile.name}
        sizeClasses="w-24 h-24"
        className="!rounded-2xl border-2 border-cnOrange-500 shadow-xl shadow-cnOrange-500/20"
      />

      <div className="space-y-1 text-center sm:text-left flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <h1 className="text-2xl font-black text-white">{profile.name}</h1>
          <span className="bg-cnOrange-500/20 text-cnOrange-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-cnOrange-500/30">
            {profile.rollNumber ? `KIIT Roll: ${profile.rollNumber}` : "KIIT Student"}
          </span>
          {profile.role === "ADMIN" && (
            <span className="bg-rose-500/20 text-rose-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-rose-500/30">
              ADMIN
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          {profile.email} • Joined{" "}
          {new Date(profile.createdAt).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })}
        </p>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2">
          <div className="text-xs text-slate-300">
            <span className="text-slate-500">Total Solved:</span>{" "}
            <strong className="text-white">{totalSolved}</strong>
          </div>
          <div className="text-xs text-slate-300">
            <span className="text-slate-500">Global Rank:</span>{" "}
            <strong className="text-cnOrange-400">
              {globalRank ? `#${globalRank}` : "Unranked"}
            </strong>
          </div>
          <div className="text-xs text-slate-300">
            <span className="text-slate-500">LeetCode:</span>{" "}
            <strong className={connected ? "text-emerald-400" : "text-slate-500"}>
              {connected ? "Connected" : "Not connected"}
            </strong>
          </div>
        </div>
      </div>

      {/* Global Manual Refresh Button */}
      <div className="self-center sm:self-start">
        <button
          onClick={onSync}
          disabled={syncing || !connected}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cnOrange-500 ${syncing ? "animate-spin" : ""}`} />
          <span>{syncing ? "Syncing..." : "Refresh Coding Stats"}</span>
        </button>
      </div>
    </div>
  );
}
