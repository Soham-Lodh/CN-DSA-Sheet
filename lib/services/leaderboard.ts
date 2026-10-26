import { prisma } from "@/lib/prisma";
import { pointsForDifficulty } from "@/lib/scoring/global";
import {
  cachedRead,
  CACHE_TAGS,
  TTL,
} from "@/lib/cache";

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
export function sortEntries<T extends { score: number; totalSolved?: number; totalSheetSolved?: number; rollNumber: string | null }>(
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
  // Stable deterministic tie-break even when roll numbers are equal.
  return entries.map((e, idx) => ({ ...e, rank: idx + 1 }));
}

// ---------------------------------------------------------------------------
// Global leaderboard: based on `PlatformSnapshot` aggregates from the
// connected coding platform. Manual sheet ticks intentionally DO NOT change
// these numbers; the global leaderboard only moves when a sync updates
// snapshots (or the configured global scoring weights change).
// ---------------------------------------------------------------------------

async function loadGlobalLeaderboard(): Promise<GlobalLeaderboardEntry[]> {
  // One bounded query: snapshot aggregates joined to profile metadata.
  const snapshots = await prisma.platformSnapshot.findMany({
    select: {
      userId: true,
      totalSolved: true,
      easySolved: true,
      mediumSolved: true,
      hardSolved: true,
      user: {
        select: {
          name: true,
          rollNumber: true,
          avatarUrl: true,
          platformAccount: { select: { username: true } },
        },
      },
    },
  });

  const entries = snapshots.map((s) => ({
    userId: s.userId,
    name: s.user.name,
    rollNumber: s.user.rollNumber,
    avatarUrl: s.user.avatarUrl,
    leetcodeUsername: s.user.platformAccount?.username ?? null,
    totalSolved: s.totalSolved,
    easySolved: s.easySolved,
    mediumSolved: s.mediumSolved,
    hardSolved: s.hardSolved,
    score: s.easySolved * pointsForDifficulty("EASY") + s.mediumSolved * pointsForDifficulty("MEDIUM") + s.hardSolved * pointsForDifficulty("HARD"),
  }));

  return sortEntries(entries);
}

export function getGlobalLeaderboard(): Promise<GlobalLeaderboardEntry[]> {
  return cachedRead(
    ["leaderboard", "global"],
    [CACHE_TAGS.leaderboardGlobal],
    TTL.globalLeaderboard,
    loadGlobalLeaderboard
  );
}

// ---------------------------------------------------------------------------
// Per-sheet leaderboard: rank by the sheet's question set, scored with the
// sheet's own weights. Manual checkbox ticks (tri-state, including explicit
// unsolved overrides) count here because per-sheet standings include manual
// completion.
// ---------------------------------------------------------------------------

interface SheetQuestionBrief {
  id: string;
  externalKey: string;
  difficulty: string;
}

async function loadSheetMetaForLeaderboard(sheetId: string) {
  return prisma.sheet.findUnique({
    where: { id: sheetId },
    select: {
      id: true,
      slug: true,
      easyPoints: true,
      mediumPoints: true,
      hardPoints: true,
      sheetQuestions: {
        orderBy: { position: "asc" as const },
        select: {
          question: { select: { id: true, externalKey: true, difficulty: true } },
        },
      },
    },
  });
}

async function loadSheetLeaderboard(sheetId: string): Promise<SheetLeaderboardEntry[]> {
  const sheet = await loadSheetMetaForLeaderboard(sheetId);
  if (!sheet || sheet.sheetQuestions.length === 0) return [];

  const totalQuestions = sheet.sheetQuestions.length;
  const questionIds = sheet.sheetQuestions.map((sq) => sq.question.id);
  const externalKeys = [...new Set(sheet.sheetQuestions.map((sq) => sq.question.externalKey))];

  // Bounded reads: only rows that can affect this sheet's questions, with
  // only the columns the score needs. Manual rows include markedSolved=false
  // entries because an explicit unsolved override hides an auto solve.
  const [autoRows, manualRows] = await Promise.all([
    prisma.solvedProblem.findMany({
      where: { externalKey: { in: externalKeys } },
      select: { userId: true, externalKey: true },
    }),
    prisma.manualProgress.findMany({
      where: { questionId: { in: questionIds } },
      select: { userId: true, questionId: true, markedSolved: true },
    }),
  ]);

  // Only users with a signal on this sheet can appear (entries with 0 solves
  // are filtered out below and never queried).
  const involvedUserIds = new Set<string>([
    ...autoRows.map((r) => r.userId),
    ...manualRows.map((r) => r.userId),
  ]);
  if (involvedUserIds.size === 0) return [];

  const profiles = await prisma.profile.findMany({
    where: { id: { in: [...involvedUserIds] } },
    select: { id: true, name: true, rollNumber: true, avatarUrl: true },
  });

  const autoByUser = new Map<string, Set<string>>();
  for (const row of autoRows) {
    let set = autoByUser.get(row.userId);
    if (!set) {
      set = new Set<string>();
      autoByUser.set(row.userId, set);
    }
    set.add(row.externalKey);
  }
  const manualByUser = new Map<string, Map<string, boolean>>();
  for (const row of manualRows) {
    let map = manualByUser.get(row.userId);
    if (!map) {
      map = new Map<string, boolean>();
      manualByUser.set(row.userId, map);
    }
    map.set(row.questionId, row.markedSolved);
  }

  const scoring = {
    easyPoints: sheet.easyPoints,
    mediumPoints: sheet.mediumPoints,
    hardPoints: sheet.hardPoints,
  };

  const entries = profiles.map((p) => {
    const autoKeys = autoByUser.get(p.id) ?? new Set<string>();
    const manualMap = manualByUser.get(p.id) ?? new Map<string, boolean>();

    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;
    let totalSheetSolved = 0;
    let score = 0;

    for (const sq of sheet.sheetQuestions) {
      const manual = manualMap.has(sq.question.id) ? manualMap.get(sq.question.id) : undefined;
      // Tri-state: manual true/false is authoritative; no row falls back to
      // the synced LeetCode match (deduplicated by canonical externalKey).
      const isSolved = manual !== undefined ? manual : autoKeys.has(sq.question.externalKey);
      if (!isSolved) continue;
      totalSheetSolved += 1;
      const pts = pointsForDifficulty(sq.question.difficulty, scoring);
      score += pts;
      if (sq.question.difficulty === "EASY") easySolved += 1;
      else if (sq.question.difficulty === "MEDIUM") mediumSolved += 1;
      else if (sq.question.difficulty === "HARD") hardSolved += 1;
    }

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
      score,
    };
  }).filter((e) => e.totalSheetSolved > 0);

  return sortEntries(entries);
}

export function getSheetLeaderboard(sheetId: string): Promise<SheetLeaderboardEntry[]> {
  /**
   * Cache wrapper that attaches the sheet's slug tag (write paths invalidate
   * per-sheet data by slug). One cheap indexed lookup, then the read.
   */
  return cachedRead(
    ["sheet-leaderboard", sheetId],
    [CACHE_TAGS.sheetsCatalogue],
    TTL.sheetLeaderboard,
    async () => {
      const sheetMeta = await prisma.sheet.findUnique({
        where: { id: sheetId },
        select: { slug: true },
      });
      const slug = sheetMeta?.slug;
      if (!slug) return [];
      return cachedRead(
        ["sheet-leaderboard-rows", sheetId],
        [CACHE_TAGS.sheetLeaderboard(slug), CACHE_TAGS.sheet(slug)],
        TTL.sheetLeaderboard,
        () => loadSheetLeaderboard(sheetId)
      );
    }
  );
}

/** Current user's global rank (reuses the cached ranking when already loaded). */
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
