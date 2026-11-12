import { Difficulty } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Admin reporting.
 *
 * - Global report: every student's LeetCode totals (easy/medium/hard) from the
 *   latest synced PlatformSnapshot.
 * - Sheet report: for one sheet, how many of THAT sheet's questions each
 *   student has solved, split by the question's difficulty. Uses the same
 *   tri-state semantics as the rest of the app (a manual override wins, no row
 *   falls back to the synced LeetCode solve).
 *
 * Both include every student in the database, including those who have not
 * linked LeetCode yet (zeros), so the report is a complete roster.
 */

export interface GlobalReportRow {
  rollNumber: string;
  email: string;
  name: string;
  leetcodeUsername: string;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
}

export interface GlobalReport {
  generatedAt: string;
  totalStudents: number;
  linkedStudents: number;
  rows: GlobalReportRow[];
}

export interface SheetReportRow {
  rollNumber: string;
  name: string;
  email: string;
  leetcodeUsername: string;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
}

export interface SheetReport {
  generatedAt: string;
  sheet: { id: string; name: string; slug: string };
  totalQuestions: number;
  totalStudents: number;
  rows: SheetReportRow[];
}

export interface SheetReportStudent {
  id: string;
  name: string;
  email: string;
  rollNumber: string | null;
  leetcodeUsername: string | null;
}

export interface SheetReportQuestion {
  id: string;
  externalKey: string;
  difficulty: Difficulty;
}

/** Deterministic report ordering: most solved first, then roll number, then name. */
function compareReportRows(a: SheetReportRow, b: SheetReportRow): number {
  const solvedA = a.easySolved + a.mediumSolved + a.hardSolved;
  const solvedB = b.easySolved + b.mediumSolved + b.hardSolved;
  if (solvedB !== solvedA) return solvedB - solvedA;
  const roll = a.rollNumber.localeCompare(b.rollNumber, "en", { numeric: true });
  if (roll !== 0) return roll;
  if (a.name !== b.name) return a.name.localeCompare(b.name);
  return a.email.localeCompare(b.email);
}

/**
 * Pure sheet-report computation (no database): one row per student with the
 * number of this sheet's easy/medium/hard questions they have solved.
 */
export function computeSheetReportRows(
  students: SheetReportStudent[],
  questions: SheetReportQuestion[],
  autoSolves: { userId: string; externalKey: string }[],
  manualOverrides: { userId: string; questionId: string; markedSolved: boolean }[]
): SheetReportRow[] {
  const autoByUser = new Map<string, Set<string>>();
  for (const solve of autoSolves) {
    let set = autoByUser.get(solve.userId);
    if (!set) {
      set = new Set<string>();
      autoByUser.set(solve.userId, set);
    }
    set.add(solve.externalKey);
  }

  const manualByUser = new Map<string, Map<string, boolean>>();
  for (const override of manualOverrides) {
    let map = manualByUser.get(override.userId);
    if (!map) {
      map = new Map<string, boolean>();
      manualByUser.set(override.userId, map);
    }
    map.set(override.questionId, override.markedSolved);
  }

  const rows = students.map<SheetReportRow>((student) => {
    const auto = autoByUser.get(student.id);
    const manual = manualByUser.get(student.id);

    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;

    for (const question of questions) {
      const override = manual?.has(question.id) ? manual.get(question.id) : undefined;
      const isSolved = override !== undefined ? override : (auto?.has(question.externalKey) ?? false);
      if (!isSolved) continue;
      if (question.difficulty === Difficulty.EASY) easySolved += 1;
      else if (question.difficulty === Difficulty.MEDIUM) mediumSolved += 1;
      else if (question.difficulty === Difficulty.HARD) hardSolved += 1;
    }

    return {
      rollNumber: student.rollNumber ?? "",
      name: student.name,
      email: student.email,
      leetcodeUsername: student.leetcodeUsername ?? "",
      easySolved,
      mediumSolved,
      hardSolved,
    };
  });

  return rows.sort(compareReportRows);
}

export async function buildGlobalReport(): Promise<GlobalReport> {
  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      rollNumber: true,
      platformAccount: { select: { username: true } },
      snapshots: {
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: { easySolved: true, mediumSolved: true, hardSolved: true },
      },
    },
  });

  const rows = profiles.map<GlobalReportRow>((profile) => {
    const snapshot = profile.snapshots[0];
    return {
      rollNumber: profile.rollNumber ?? "",
      email: profile.email,
      name: profile.name,
      leetcodeUsername: profile.platformAccount?.username ?? "",
      easySolved: snapshot?.easySolved ?? 0,
      mediumSolved: snapshot?.mediumSolved ?? 0,
      hardSolved: snapshot?.hardSolved ?? 0,
    };
  });

  rows.sort(compareReportRows);

  return {
    generatedAt: new Date().toISOString(),
    totalStudents: rows.length,
    linkedStudents: profiles.filter((profile) => profile.platformAccount !== null).length,
    rows,
  };
}

export async function buildSheetReport(sheetId: string): Promise<SheetReport | null> {
  const sheet = await prisma.sheet.findUnique({
    where: { id: sheetId },
    select: {
      id: true,
      name: true,
      slug: true,
      sheetQuestions: {
        orderBy: { position: "asc" },
        select: { question: { select: { id: true, externalKey: true, difficulty: true } } },
      },
    },
  });
  if (!sheet) return null;

  const questions: SheetReportQuestion[] = sheet.sheetQuestions.map((link) => link.question);
  const questionIds = questions.map((question) => question.id);
  const externalKeys = [...new Set(questions.map((question) => question.externalKey))];

  const [profiles, autoSolves, manualOverrides] = await Promise.all([
    prisma.profile.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        platformAccount: { select: { username: true } },
      },
    }),
    externalKeys.length > 0
      ? prisma.solvedProblem.findMany({
          where: { externalKey: { in: externalKeys } },
          select: { userId: true, externalKey: true },
        })
      : Promise.resolve([] as { userId: string; externalKey: string }[]),
    questionIds.length > 0
      ? prisma.manualProgress.findMany({
          where: { questionId: { in: questionIds } },
          select: { userId: true, questionId: true, markedSolved: true },
        })
      : Promise.resolve([] as { userId: string; questionId: string; markedSolved: boolean }[]),
  ]);

  const students: SheetReportStudent[] = profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    rollNumber: profile.rollNumber,
    leetcodeUsername: profile.platformAccount?.username ?? null,
  }));

  const rows = computeSheetReportRows(students, questions, autoSolves, manualOverrides);

  return {
    generatedAt: new Date().toISOString(),
    sheet: { id: sheet.id, name: sheet.name, slug: sheet.slug },
    totalQuestions: questions.length,
    totalStudents: rows.length,
    rows,
  };
}
