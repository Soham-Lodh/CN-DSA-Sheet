import { prisma } from "@/lib/prisma";
import { pointsForDifficulty } from "@/lib/scoring/global";

export interface GlobalLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  rollNumber: string | null;
  avatarUrl: string | null;
  leetcodeUsername: string | null;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  score: number;
}

export interface SheetLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  rollNumber: string | null;
  avatarUrl: string | null;
  totalSheetSolved: number;
  totalSheetQuestions: number;
  completionPercent: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  score: number;
}

/** Deterministic ordering: score desc, solved desc, then roll number. */
function sortEntries<T extends { score: number; totalSolved?: number; totalSheetSolved?: number; rollNumber: string | null }>(
  entries: T[]
): (T & { rank: number })[] {
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const solvedA = a.totalSolved ?? a.totalSheetSolved ?? 0;
    const solvedB = b.totalSolved ?? b.totalSheetSolved ?? 0;
    if (solvedB !== solvedA) return solvedB - solvedA;
    const rollA = a.rollNumber || "zzzz";
    const rollB = b.rollNumber || "zzzz";
    return rollA.localeCompare(rollB);
  });
  return entries.map((e, idx) => ({ ...e, rank: idx + 1 }));
}

/**
 * Global KIIT leaderboard, LeetCode-only. The E/M/H split and total come from
 * the synced PlatformSnapshot (LeetCode's own all-time aggregates), so they
 * match the profile page exactly. Score = easy*1 + medium*4 + hard*8.
 */
export async function getGlobalLeaderboard(): Promise<GlobalLeaderboardEntry[]> {
  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
      name: true,
      rollNumber: true,
      avatarUrl: true,
      platformAccount: { select: { username: true } },
      snapshots: {
        select: { totalSolved: true, easySolved: true, mediumSolved: true, hardSolved: true },
      },
    },
  });

  const entries = profiles.map((p) => {
    const s = p.snapshots[0];
    const easySolved = s?.easySolved ?? 0;
    const mediumSolved = s?.mediumSolved ?? 0;
    const hardSolved = s?.hardSolved ?? 0;
    return {
      userId: p.id,
      name: p.name,
      rollNumber: p.rollNumber,
      avatarUrl: p.avatarUrl,
      leetcodeUsername: p.platformAccount?.username ?? null,
      totalSolved: s?.totalSolved ?? 0,
      easySolved,
      mediumSolved,
      hardSolved,
      score:
        easySolved * pointsForDifficulty("EASY") +
        mediumSolved * pointsForDifficulty("MEDIUM") +
        hardSolved * pointsForDifficulty("HARD"),
    };
  });

  return sortEntries(entries);
}

/**
 * Per-sheet leaderboard: rank by sheet questions solved, scored with the
 * sheet's own Easy/Medium/Hard point values (default 1/4/8).
 */
export async function getSheetLeaderboard(sheetId: string): Promise<SheetLeaderboardEntry[]> {
  const sheet = await prisma.sheet.findUnique({
    where: { id: sheetId },
    select: {
      easyPoints: true,
      mediumPoints: true,
      hardPoints: true,
      sheetQuestions: {
        orderBy: { position: "asc" },
        select: { question: { select: { id: true, externalKey: true, difficulty: true } } },
      },
    },
  });
  if (!sheet || sheet.sheetQuestions.length === 0) return [];

  const totalQuestions = sheet.sheetQuestions.length;

  const [profiles, manualProgress] = await Promise.all([
    prisma.profile.findMany({
      select: {
        id: true,
        name: true,
        rollNumber: true,
        avatarUrl: true,
        solvedProblems: { select: { externalKey: true } },
      },
    }),
    prisma.manualProgress.findMany({ where: { markedSolved: true } }),
  ]);
  const manualByUser = new Map<string, Set<string>>();
  for (const mp of manualProgress) {
    if (!manualByUser.has(mp.userId)) manualByUser.set(mp.userId, new Set());
    manualByUser.get(mp.userId)!.add(mp.questionId);
  }

  const entries = profiles
    .map((p) => {
      // A sheet question counts as solved when the user's synced LeetCode
      // records match its externalKey OR they manually ticked it.
      const autoKeys = new Set(p.solvedProblems.map((sp) => sp.externalKey));
      const solvedDifficulties: string[] = [];
      for (const sq of sheet.sheetQuestions) {
        if (autoKeys.has(sq.question.externalKey) || manualByUser.get(p.id)?.has(sq.question.id)) {
          solvedDifficulties.push(sq.question.difficulty);
        }
      }
      const totalSheetSolved = solvedDifficulties.length;
      const easySolved = solvedDifficulties.filter((d) => d === "EASY").length;
      const mediumSolved = solvedDifficulties.filter((d) => d === "MEDIUM").length;
      const hardSolved = solvedDifficulties.filter((d) => d === "HARD").length;
      return {
        userId: p.id,
        name: p.name,
        rollNumber: p.rollNumber,
        avatarUrl: p.avatarUrl,
        totalSheetSolved,
        totalSheetQuestions: totalQuestions,
        completionPercent: Math.round((totalSheetSolved / totalQuestions) * 1000) / 10,
        easySolved,
        mediumSolved,
        hardSolved,
        score:
          easySolved * sheet.easyPoints +
          mediumSolved * sheet.mediumPoints +
          hardSolved * sheet.hardPoints,
      };
    })
    .filter((e) => e.totalSheetSolved > 0);

  return sortEntries(entries);
}

/** Current user's global rank (reuses the full ranking when already loaded). */
export function rankOfUser(
  userId: string | undefined,
  leaderboard: GlobalLeaderboardEntry[]
): number | null {
  if (!userId) return null;
  const index = leaderboard.findIndex((item) => item.userId === userId);
  return index !== -1 ? index + 1 : null;
}

export async function getUserGlobalRank(userId: string): Promise<number | null> {
  return rankOfUser(userId, await getGlobalLeaderboard());
}
