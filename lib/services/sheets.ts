import { prisma } from "@/lib/prisma";
import { Difficulty, SheetStatus } from "@prisma/client";
import { pointsForDifficulty } from "@/lib/scoring/global";
import { withStrictLocking, userLockKey, questionLockKey, TxClient } from "@/lib/locking";
import {
  claimIdempotencyKey,
  completeIdempotencyClaim,
  fingerprintPayload,
} from "@/lib/idempotency";
import { cachedRead, invalidateTags, progressInvalidationTags, TTL, CACHE_TAGS } from "@/lib/cache";
import { ApiError } from "@/lib/api-errors";

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
  /** "AUTO" = matched from synced LeetCode data; "MANUAL" = user checkbox tri-state row; null = unsolved. */
  solvedSource: "AUTO" | "MANUAL" | null;
  /** ISO timestamp of the synced solve when AUTO, else null. */
  solvedAt?: string | null;
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

/** User's manual override for a sheet question (tri-state). */
export type ManualOverride = boolean | null;

/**
 * Tri-state effective solved semantics (docs A2):
 *   - a manual row with markedSolved=true explicitly means "solved"
 *   - a manual row with markedSolved=false explicitly overrides an
 *     auto-detected (LeetCode synced) solve and means "unsolved"
 *   - no manual row falls back to the synced LeetCode state
 */
export function resolveEffectiveSolved(
  manual: boolean | undefined,
  autoSolved: boolean
): boolean {
  if (manual === undefined) return autoSolved;
  return manual;
}

export function resolveSolvedSource(
  manual: boolean | undefined,
  effective: boolean
): "AUTO" | "MANUAL" | null {
  if (manual !== undefined) return "MANUAL";
  return effective ? "AUTO" : null;
}

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
 * Build one SheetProgressSummary with the tri-state resolution above.
 * `autoSolvedMap` keys by externalKey; `manualMap` keys by question id.
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
    const manual = manualMap.has(q.id) ? manualMap.get(q.id) : undefined;
    const isSolved = resolveEffectiveSolved(manual, auto !== undefined);
    const solvedSource = resolveSolvedSource(manual, isSolved);
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
      solvedAt: auto && isSolved ? (auto.solvedAt ? new Date(auto.solvedAt).toISOString() : null) : null,
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

/** per-user (private, short TTL) / anonymous (public, longer TTL) reading. */
export async function getSheetWithUserProgress(
  slug: string,
  userId?: string
): Promise<SheetProgressSummary | null> {
  if (!userId) {
    return cachedRead(
      ["sheet-progress", slug, "anon"],
      [CACHE_TAGS.sheet(slug), CACHE_TAGS.sheetsCatalogue],
      TTL.sheetCatalogue,
      () => loadSheetProgress(slug, undefined)
    );
  }
  return cachedRead(
    ["sheet-progress", slug, userId],
    [CACHE_TAGS.sheet(slug), CACHE_TAGS.userProgress(userId)],
    TTL.userProgress,
    () => loadSheetProgress(slug, userId)
  );
}

async function loadSheetProgress(
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
  return cachedRead(
    ["sheets-list", userId ?? "anon"],
    userId ? [CACHE_TAGS.sheetsCatalogue, CACHE_TAGS.userProgress(userId)] : [CACHE_TAGS.sheetsCatalogue],
    userId ? TTL.userProgress : TTL.sheetCatalogue,
    () => loadSheetsList(userId)
  );
}

async function loadSheetsList(userId?: string) {
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
    const manual = manualMap.has(sq.questionId) ? manualMap.get(sq.questionId) : undefined;
    const isSolved = resolveEffectiveSolved(manual, autoSolvedMap.has(sq.question.externalKey));
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

// ---------------------------------------------------------------------------
// Progress mutation: set-state, idempotent, strictly-locked, multi-sheet aware
// ---------------------------------------------------------------------------

export interface AffectedSheetSummary {
  sheetId: string;
  slug: string;
  name: string;
  totalQuestions: number;
  solvedQuestions: number;
  remainingQuestions: number;
  completionPercent: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  score: number;
  /** The acting user's own row for this sheet (for optimistic standings updates). */
  userRow: {
    userId: string;
    name: string;
    rollNumber: string | null;
    avatarUrl: string | null;
    totalSheetSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    score: number;
    completionPercent: number;
  };
}

export interface ProgressMutationResult {
  questionId: string;
  /** Effective persisted state after this call. */
  solved: boolean;
  source: "AUTO" | "MANUAL" | null;
  /** False when the desired state was already persisted (idempotent no-op). */
  changed: boolean;
  /** Every published sheet containing this question, with committed counts. */
  sheets: AffectedSheetSummary[];
}

const PROGRESS_ROUTE = "sheets/progress";

/**
 * Persists the user's desired solved state for a question (never a toggle):
 *
 *  - set-state contract: the client sends the target boolean; a retry cannot
 *    reverse or duplicate it.
 *  - durable idempotency: keyed by the client-supplied Idempotency-Key scoped
 *    to (user, route); same key+payload replays the recorded response, a key
 *    reused with a different payload is a controlled conflict.
 *  - strict 2PL: locks for `user:<id>` and `question:<id>` are both derived
 *    before the transaction and acquired in canonical sorted order via
 *    transaction-scoped advisory locks; they are released only by commit.
 *  - final guard: the unique constraint on (userId, questionId) makes the
 *    manual override row idempotent even under concurrent identical writes.
 *  - tri-state override: manual true forces solved, manual false explicitly
 *    overrides an auto-solved question, no row falls back to synced state.
 *  - multi-sheet: every published sheet containing this question receives an
 *    authoritative count/score summary plus the user's own standings row.
 */
export async function setQuestionProgress(
  userId: string,
  userInfo: { name: string; rollNumber: string | null; avatarUrl: string | null },
  questionId: string,
  solved: boolean,
  idempotencyKey?: string
): Promise<ProgressMutationResult> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, externalKey: true },
  });
  if (!question) {
    throw new ApiError("NOT_FOUND", 404, "Question not found.");
  }

  const hasPublishedSheet = await prisma.sheetQuestion.findFirst({
    where: { questionId, sheet: { status: SheetStatus.PUBLISHED } },
    select: { id: true },
  });
  if (!hasPublishedSheet) {
    throw new ApiError("NOT_FOUND", 404, "Question not found in any published sheet.");
  }

  const fingerprint = fingerprintPayload({ questionId, solved });
  const lockKeys = [userLockKey(userId), questionLockKey(questionId)];

  const { result, affectedSlugs } = await withStrictLocking(
    { lockKeys, idempotent: true },
    async (tx: TxClient) => {
      const [existingManual, autoSolvedRow] = await Promise.all([
        tx.manualProgress.findUnique({
          where: { userId_questionId: { userId, questionId } },
          select: { markedSolved: true },
        }),
        tx.solvedProblem.findUnique({
          where: { userId_externalKey: { userId, externalKey: question.externalKey } },
          select: { id: true },
        }),
      ]);

      let claim = idempotencyKey
        ? await claimIdempotencyKey(tx, {
            userId,
            route: PROGRESS_ROUTE,
            key: idempotencyKey,
            fingerprint,
          })
        : { kind: "EXECUTE" as const, id: "" /* no-key mode: still race-safe via locks */ };

      if (claim.kind === "REPLAY") {
        const recorded = claim.recordedResult as ProgressMutationResult | null;
        if (recorded && typeof recorded === "object" && "solved" in recorded) {
          // Data could have moved between recorded completion and now; trust
          // the ledger result (it was authoritative at commit time).
          return { result: recorded, affectedSlugs: [] };
        }
        // Malformed record (should not happen): fall through and recompute.
        claim = { kind: "EXECUTE", id: "" };
      }

      const manual = existingManual?.markedSolved;
      const autoSolved = autoSolvedRow !== null;
      const effectiveNow = resolveEffectiveSolved(manual, autoSolved);

      let changed = false;
      if (claim.kind === "EXECUTE" && effectiveNow !== solved) {
        // Set-state upsert; (userId, questionId) unique constraint is the
        // final guard against two concurrent setters.
        await tx.manualProgress.upsert({
          where: { userId_questionId: { userId, questionId } },
          create: { userId, questionId, markedSolved: solved, markedAt: new Date() },
          update: { markedSolved: solved, markedAt: new Date() },
        });
        changed = true;
      }

      // Discover EVERY published sheet containing this question (not just one
      // arbitrary parent) and compute authoritative summaries for each.
      const affectedRows = await tx.sheetQuestion.findMany({
        where: { questionId, sheet: { status: SheetStatus.PUBLISHED } },
        select: {
          sheet: {
            select: {
              id: true,
              slug: true,
              name: true,
              easyPoints: true,
              mediumPoints: true,
              hardPoints: true,
            },
          },
        },
      });
      const sheets = affectedRows.map((sq) => sq.sheet);
      const sheetIds = sheets.map((s) => s.id);

      // Shared per-user solve state for summary computation.
      const [autoRows, manualAll] = await Promise.all([
        tx.solvedProblem.findMany({
          where: { userId },
          select: { externalKey: true },
        }),
        tx.manualProgress.findMany({
          where: { userId },
          select: { questionId: true, markedSolved: true },
        }),
      ]);
      const autoKeys = new Set(autoRows.map((r) => r.externalKey));
      const manualMap = new Map(manualAll.map((m) => [m.questionId, m.markedSolved]));

      const affectedSheetSummaries: AffectedSheetSummary[] = [];
      for (const sheet of sheets) {
        const sqs = await tx.sheetQuestion.findMany({
          where: { sheetId: sheet.id },
          select: {
            question: { select: { id: true, externalKey: true, difficulty: true } },
          },
        });

        let easy = 0, medium = 0, hard = 0, solvedCount = 0, score = 0;
        for (const sq of sqs) {
          const manualState = manualMap.has(sq.question.id) ? manualMap.get(sq.question.id) : undefined;
          const isSolved = resolveEffectiveSolved(manualState, autoKeys.has(sq.question.externalKey));
          if (!isSolved) continue;
          solvedCount += 1;
          const pts = pointsForDifficulty(sq.question.difficulty, sheet);
          score += pts;
          if (sq.question.difficulty === "EASY") easy += 1;
          else if (sq.question.difficulty === "MEDIUM") medium += 1;
          else if (sq.question.difficulty === "HARD") hard += 1;
        }

        const total = sqs.length;

        affectedSheetSummaries.push({
          sheetId: sheet.id,
          slug: sheet.slug,
          name: sheet.name,
          totalQuestions: total,
          solvedQuestions: solvedCount,
          remainingQuestions: Math.max(0, total - solvedCount),
          completionPercent: total > 0 ? Math.round((solvedCount / total) * 1000) / 10 : 0,
          easySolved: easy,
          mediumSolved: medium,
          hardSolved: hard,
          score,
          userRow: {
            userId,
            name: userInfo.name,
            rollNumber: userInfo.rollNumber,
            avatarUrl: userInfo.avatarUrl,
            totalSheetSolved: solvedCount,
            easySolved: easy,
            mediumSolved: medium,
            hardSolved: hard,
            score,
            completionPercent: total > 0 ? Math.round((solvedCount / total) * 1000) / 10 : 0,
          },
        });
      }

      const finalManual = changed ? solved : manual;
      const mutationResult: ProgressMutationResult = {
        questionId,
        solved: changed ? solved : effectiveNow,
        source: resolveSolvedSource(finalManual, changed ? solved : effectiveNow),
        changed,
        sheets: affectedSheetSummaries,
      };

      if (idempotencyKey && claim.kind === "EXECUTE") {
        await completeIdempotencyClaim(tx, claim.id, mutationResult);
      }

      return {
        result: mutationResult,
        affectedSlugs: changed ? affectedSheetSummaries.map((s) => s.slug) : [],
      };
    },
    prisma
  );

  // Post-commit invalidation, only for actually-affected sheets.
  await invalidateTags(progressInvalidationTags(userId, affectedSlugs));
  return result;
}

/** Final guard: a user can never write another user's progress (never called with a body-supplied id). */
export function assertOwnProfile(profileId: string, userId: string) {
  if (profileId !== userId) {
    throw new ApiError("FORBIDDEN", 403, "You cannot modify another user's progress.");
  }
}
