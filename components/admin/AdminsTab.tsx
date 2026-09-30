"use client";

import { useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { Search, ShieldCheck, ShieldOff, UserPlus, Trash2, Users } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import type { AdminProfile } from "./types";

interface AdminsTabProps {
  profiles: AdminProfile[];
  currentAdminId: string;
  error: string | null;
  onSetRole: (userId: string, role: Role) => void;
  onDeleteUser: (userId: string) => void;
}

const roleClasses: Record<string, string> = {
  ADMIN: "bg-status-danger/20 text-status-danger border-status-danger/30",
  USER: "bg-outline-subtle/50 text-content-secondary border-outline-subtle/40",
};

/** Admin management tab: real profiles from the DB, with role + delete controls. */
export function AdminsTab({
  profiles,
  currentAdminId,
  error,
  onSetRole,
  onDeleteUser,
}: AdminsTabProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.rollNumber || "").toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const adminCount = profiles.filter((p) => p.role === Role.ADMIN).length;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 border border-outline-subtle">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-content-primary flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-primary" />
            <span>User Roles &amp; Administrators</span>
          </h3>
          <p className="text-[11px] text-content-muted mt-0.5">
            {profiles.length} registered users • {adminCount} admin
            {adminCount === 1 ? "" : "s"} • changes here are equivalent to the SQL commands in
            SETUP.md
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or roll no..."
            className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-lg bg-surface-elevated/80 border border-outline-subtle text-xs text-content-primary placeholder:text-content-muted focus:outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-elevated text-content-muted uppercase font-semibold">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Roll Number</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Data</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-subtle">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-content-muted">
                  No users match this search.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const isSelf = p.id === currentAdminId;
                const isAdmin = p.role === Role.ADMIN;
                return (
                  <tr key={p.id} className="hover:bg-surface-elevated/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          avatarUrl={p.avatarUrl}
                          name={p.name}
                          sizeClasses="w-7 h-7"
                          className="border border-outline-subtle"
                        />
                        <div>
                          <div className="font-bold text-content-primary flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isSelf && (
                              <span className="text-[9px] bg-status-info/20 text-status-info border border-status-info/30 px-1 rounded font-mono">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-content-muted font-mono">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-content-muted">
                      {p.rollNumber || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          roleClasses[p.role] ?? roleClasses.USER
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-content-muted">
                      {p.platformAccount ? `LC: ${p.platformAccount.username}` : "No LeetCode"} • {p._count.solvedProblems} solved
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      {!isAdmin && (
                        <button
                          onClick={() => onSetRole(p.id, Role.ADMIN)}
                          title="Promote to administrator"
                          className="px-2.5 py-1 rounded bg-status-success hover:bg-status-success text-content-primary font-bold text-[10px] inline-flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          Make Admin
                        </button>
                      )}
                      {isAdmin && !isSelf && (
                        <button
                          onClick={() => onSetRole(p.id, Role.USER)}
                          title="Demote to regular user"
                          className="px-2.5 py-1 rounded bg-rank-bronze hover:bg-brand-accent text-content-primary font-bold text-[10px] inline-flex items-center gap-1"
                        >
                          <ShieldOff className="w-3 h-3" />
                          Demote
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          onClick={() => onDeleteUser(p.id)}
                          title="Permanently delete this user"
                          className="px-2.5 py-1 rounded bg-status-danger hover:bg-status-danger text-content-primary font-bold text-[10px] inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-elevated/50 border border-outline-subtle/60">
        <ShieldCheck className="w-4 h-4 text-status-success flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-content-muted leading-relaxed">
          The last remaining administrator cannot be demoted or deleted, and you cannot change
          your own role while signed in — this guarantees at least one admin always exists.
          Deleting a user removes their synced platform data and unlinks their Google account.
        </p>
      </div>
    </div>
  );
}
