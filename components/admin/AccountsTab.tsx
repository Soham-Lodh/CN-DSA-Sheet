import { VerificationStatus } from "@prisma/client";
import type { AdminPlatformAccount } from "./types";

interface AccountsTabProps {
  accounts: AdminPlatformAccount[];
  onSetStatus: (accountId: string, status: VerificationStatus) => void;
}

const statusClasses: Record<string, string> = {
  VERIFIED: "bg-status-success/20 text-status-success",
  PENDING: "bg-brand-accent/20 text-brand-accent",
};

/** LeetCode accounts tab: review student handles and verify or reject them. */
export function AccountsTab({ accounts, onSetStatus }: AccountsTabProps) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 border border-outline-subtle">
      <h3 className="font-bold text-sm text-content-primary">Connected Student Accounts</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-elevated text-content-muted uppercase font-semibold">
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Roll Number</th>
              <th className="py-3 px-4">LeetCode Handle</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Verification Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-subtle">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-content-muted">
                  No students have connected their LeetCode accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-surface-elevated/60">
                  <td className="py-3 px-4 font-bold text-content-primary">{acc.user.name}</td>
                  <td className="py-3 px-4 font-mono text-content-muted">
                    {acc.user.rollNumber || acc.user.email}
                  </td>
                  <td className="py-3 px-4 font-bold text-brand-accent font-mono">{acc.username}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        statusClasses[acc.verificationStatus] ?? "bg-status-danger/20 text-status-danger"
                      }`}
                    >
                      {acc.verificationStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {acc.verificationStatus !== "VERIFIED" && (
                      <button
                        onClick={() => onSetStatus(acc.id, VerificationStatus.VERIFIED)}
                        className="px-2.5 py-1 rounded bg-status-success hover:bg-status-success text-content-primary font-bold text-[10px]"
                      >
                        Verify
                      </button>
                    )}
                    {acc.verificationStatus !== "REJECTED" && (
                      <button
                        onClick={() => onSetStatus(acc.id, VerificationStatus.REJECTED)}
                        className="px-2.5 py-1 rounded bg-status-danger hover:bg-status-danger text-content-primary font-bold text-[10px]"
                      >
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
