import { VerificationStatus } from "@prisma/client";
import type { AdminPlatformAccount } from "./types";

interface AccountsTabProps {
  accounts: AdminPlatformAccount[];
  onSetStatus: (accountId: string, status: VerificationStatus) => void;
}

const statusClasses: Record<string, string> = {
  VERIFIED: "bg-emerald-500/20 text-emerald-400",
  PENDING: "bg-amber-500/20 text-amber-400",
};

/** LeetCode accounts tab: review student handles and verify or reject them. */
export function AccountsTab({ accounts, onSetStatus }: AccountsTabProps) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 border border-slate-800">
      <h3 className="font-bold text-sm text-white">Connected Student Accounts</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-800 text-slate-400 uppercase font-semibold">
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Roll Number</th>
              <th className="py-3 px-4">LeetCode Handle</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Verification Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No students have connected their LeetCode accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-800/60">
                  <td className="py-3 px-4 font-bold text-white">{acc.user.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {acc.user.rollNumber || acc.user.email}
                  </td>
                  <td className="py-3 px-4 font-bold text-amber-400 font-mono">{acc.username}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        statusClasses[acc.verificationStatus] ?? "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      {acc.verificationStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {acc.verificationStatus !== "VERIFIED" && (
                      <button
                        onClick={() => onSetStatus(acc.id, VerificationStatus.VERIFIED)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]"
                      >
                        Verify
                      </button>
                    )}
                    {acc.verificationStatus !== "REJECTED" && (
                      <button
                        onClick={() => onSetStatus(acc.id, VerificationStatus.REJECTED)}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]"
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
