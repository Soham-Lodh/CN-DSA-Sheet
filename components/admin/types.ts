import type {
  PlatformAccount,
  Profile,
  Question,
  Sheet,
  SheetQuestion,
  SyncLog,
} from "@prisma/client";

export interface AdminOverview {
  totalUsers: number;
  totalSheets: number;
  publishedSheets: number;
  totalQuestions: number;
  totalSolvedRecords: number;
  leetcodeAccounts: number;
  recentFailedSyncs: number;
}

export type AdminSheet = Sheet & { _count: { sheetQuestions: number } };
export type AdminSheetQuestion = SheetQuestion & { question: Question; sheet: Sheet | null };
export type AdminPlatformAccount = PlatformAccount & { user: { name: string; rollNumber: string | null; email: string } };
export type AdminSyncLog = SyncLog & { user: { name: string } | null };

export type AdminProfile = Profile & {
  platformAccount: { username: string } | null;
  _count: { solvedProblems: number };
};

export interface AdminData {
  overview: AdminOverview;
  sheets: AdminSheet[];
  questions: AdminSheetQuestion[];
  platformAccounts: AdminPlatformAccount[];
  syncLogs: AdminSyncLog[];
  profiles: AdminProfile[];
  currentAdminId: string;
}

export type AdminTab =
  | "overview"
  | "questions"
  | "sheets"
  | "accounts"
  | "admins";
