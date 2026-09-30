import { prisma } from "@/lib/prisma";
import { Difficulty, SheetStatus } from "@prisma/client";
import { pointsForDifficulty } from "@/lib/scoring/global";

export interface SheetQuestionItem {
  id: string;
  sheetQuestionId: string;
  position: number;
  externalKey: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  topic: string;
  tags: string[];
  isSolved: boolean;
  /** "AUTO" = matched from synced LeetCode data; "MANUAL" = user ticked the checkbox. */
  solvedSource: "AUTO" | "MANUAL" | null;
  solvedAt?: Date | null;
}

export interface SheetProgressSummary {
  sheet: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: SheetStatus;
    /** Per-sheet scoring (points per solved Easy/Medium/Hard). */
    easyPoints: number;
    mediumPoints: number;
    hardPoints: number;
  };
  totalQuestions: number;
  solvedQuestions: number;
  remainingQuestions: number;
  completionPercent: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  score: number;
  questions: SheetQuestionItem[];
}

/** User's manual override for a sheet question (null = fall back to auto). */
type ManualOverride = boolean | null;

/** Shared question shape returned by Prisma includes for sheet questions. */
interface SheetQuestionWithQuestion {
  id: string;
  position: number;
  question: {
    id: string;
    externalKey: string;
    title: string;
    url: string;
    difficulty: Difficulty;
    topic: string;
    tags: string[];
  };
}

/**
 * Build one SheetProgressSummary. Solved status resolution:
 * manual override (checkbox) if set, otherwise the synced LeetCode match.
 */
function buildProgress(
  sheet: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: SheetStatus;
    easyPoints: number;
    mediumPoints: number;
    hardPoints: number;
    sheetQuestions: SheetQuestionWithQuestion[];
  },
  autoSolvedMap: Map<string, { solvedAt: Date | null } | undefined>,
  manualMap: Map<string, boolean>
): SheetProgressSummary {
  const solvedItems: { difficulty: Difficulty }[] = [];

  const questions: SheetQuestionItem[] = sheet.sheetQuestions.map((sq) => {
    const q = sq.question;
    const auto = autoSolvedMap.get(q.externalKey);
    const manual = manualMap.get(q.id);
    const isSolved = manual ?? Boolean(auto);
    const solvedSource: "AUTO" | "MANUAL" | null =
      manual !== undefined ? "MANUAL" : isSolved ? "AUTO" : null;
    if (isSolved) solvedItems.push({ difficulty: q.difficulty });
    return {
      id: q.id,
      sheetQuestionId: sq.id,
      position: sq.position,
      externalKey: q.externalKey,
      title: q.title,
      url: q.url,
      difficulty: q.difficulty,
      topic: q.topic,
      tags: q.tags,
      isSolved,
      solvedSource,
      solvedAt: auto?.solvedAt ?? null,
    };
  });

  const tally = {
    easySolved: solvedItems.filter((i) => i.difficulty === "EASY").length,
    mediumSolved: solvedItems.filter((i) => i.difficulty === "MEDIUM").length,
    hardSolved: solvedItems.filter((i) => i.difficulty === "HARD").length,
  };
  const config = {
    easyPoints: sheet.easyPoints,
    mediumPoints: sheet.mediumPoints,
    hardPoints: sheet.hardPoints,
  };
  const score = solvedItems.reduce(
    (acc, i) => acc + pointsForDifficulty(i.difficulty, config),
    0
  );
  const totalQuestions = questions.length;
  const solvedQuestions = questions.filter((q) => q.isSolved).length;

  return {
    sheet: {
      id: sheet.id,
      name: sheet.name,
      slug: sheet.slug,
      description: sheet.description,
      status: sheet.status,
      ...config,
    },
    totalQuestions,
    solvedQuestions,
    remainingQuestions: Math.max(0, totalQuestions - solvedQuestions),
    completionPercent:
      totalQuestions > 0 ? Math.round((solvedQuestions / totalQuestions) * 1000) / 10 : 0,
    ...tally,
    score,
    questions,
  };
}

/** Load the user's auto (synced) + manual solve state into lookup maps. */
async function loadSolvedMaps(userId: string) {
  const [solved, manual] = await Promise.all([
    prisma.solvedProblem.findMany({
      where: { userId },
      select: { externalKey: true, solvedAt: true },
    }),
    prisma.manualProgress.findMany({
      where: { userId },
      select: { questionId: true, markedSolved: true },
    }),
  ]);

  const autoSolvedMap = new Map(solved.map((s) => [s.externalKey, { solvedAt: s.solvedAt }]));
  const manualMap = new Map(manual.map((m) => [m.questionId, m.markedSolved]));
  return { autoSolvedMap, manualMap };
}

export async function getSheetWithUserProgress(
  slug: string,
  userId?: string
): Promise<SheetProgressSummary | null> {
  const sheet = await prisma.sheet.findUnique({
    where: { slug },
    include: {
      sheetQuestions: { orderBy: { position: "asc" }, include: { question: true } },
    },
  });
  if (!sheet) return null;

  if (!userId) return buildProgress(sheet, new Map(), new Map());

  const { autoSolvedMap, manualMap } = await loadSolvedMaps(userId);
  return buildProgress(sheet, autoSolvedMap, manualMap);
}

/** All PUBLISHED sheets with full per-question progress (profile dashboard). */
export async function getAllSheetsWithFullProgress(
  userId?: string
): Promise<SheetProgressSummary[]> {
  const sheets = await prisma.sheet.findMany({
    where: { status: SheetStatus.PUBLISHED },
    orderBy: { createdAt: "asc" },
    include: {
      sheetQuestions: { orderBy: { position: "asc" }, include: { question: true } },
    },
  });

  if (!userId) return sheets.map((s) => buildProgress(s, new Map(), new Map()));

  const { autoSolvedMap, manualMap } = await loadSolvedMaps(userId);
  return sheets.map((sheet) => buildProgress(sheet, autoSolvedMap, manualMap));
}

/** Lightweight sheet list with solved counts (dashboard / sheet switcher). */
export async function getAllSheetsWithUserProgress(userId?: string) {
  const sheets = await prisma.sheet.findMany({
    where: { status: SheetStatus.PUBLISHED },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { sheetQuestions: true } },
    },
  });

  if (!userId || sheets.length === 0) {
    return sheets.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      totalQuestions: s._count.sheetQuestions,
      solvedQuestions: 0,
      completionPercent: 0,
    }));
  }

  const { autoSolvedMap, manualMap } = await loadSolvedMaps(userId);

  const sheetQuestions = await prisma.sheetQuestion.findMany({
    where: { sheet: { status: SheetStatus.PUBLISHED } },
    select: { sheetId: true, id: true, questionId: true, question: { select: { externalKey: true } } },
  });

  const solvedBySheet = new Map<string, number>();
  for (const sq of sheetQuestions) {
    const isSolved = manualMap.get(sq.questionId) ?? autoSolvedMap.has(sq.question.externalKey);
    if (isSolved) {
      solvedBySheet.set(sq.sheetId, (solvedBySheet.get(sq.sheetId) ?? 0) + 1);
    }
  }

  return sheets.map((s) => {
    const solvedCount = solvedBySheet.get(s.id) ?? 0;
    const total = s._count.sheetQuestions;
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      totalQuestions: total,
      solvedQuestions: solvedCount,
      completionPercent: total > 0 ? Math.round((solvedCount / total) * 1000) / 10 : 0,
    };
  });
}

/**
 * Toggle the user's manual tick on a sheet question. Toggling ON creates a
 * ManualProgress row; toggling OFF deletes it (falling back to auto status),
 * so unsolving never fights a future re-sync.
 */
export async function toggleQuestionProgress(
  userId: string,
  questionId: string,
  solved: boolean
): Promise<{ questionId: string; isSolved: boolean }> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });
  if (!question) throw new Error("Question not found");

  if (solved) {
    await prisma.manualProgress.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId, markedSolved: true },
      update: { markedSolved: true, markedAt: new Date() },
    });
  } else {
    await prisma.manualProgress.deleteMany({ where: { userId, questionId } });
  }

  return { questionId, isSolved: solved };
}
