import { prisma } from "@/lib/prisma";

/** One cell of the activity heatmap. */
export interface ActivityDay {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  count: number;
}

export interface CombinedActivity {
  days: ActivityDay[];
  totalSubmissions: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

/** Activity window: 1 full year, GitHub-style. */
export const ACTIVITY_WINDOW_DAYS = 365;

function isoDateOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Daily solved counts for the 365-day heatmap. Primary source is LeetCode's
 * own submissionCalendar (identical to the calendar on leetcode.com, fetched
 * during sync and cached in the snapshot), merged with locally-known
 * SolvedProblem dates so newly synced problems appear immediately.
 */
export async function getCombinedActivity(
  userId: string,
  windowDays: number = ACTIVITY_WINDOW_DAYS
): Promise<CombinedActivity> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000);
  const windowStartMidnight = Date.UTC(
    windowStart.getUTCFullYear(),
    windowStart.getUTCMonth(),
    windowStart.getUTCDate()
  );

  const [snapshot, solved] = await Promise.all([
    prisma.platformSnapshot.findUnique({
      where: { userId },
      select: { rawMetadata: true },
    }),
    prisma.solvedProblem.findMany({
      where: { userId, solvedAt: { gte: new Date(windowStartMidnight) } },
      select: { solvedAt: true },
    }),
  ]);

  const buckets = new Map<string, number>();
  const add = (iso: string, n: number) => buckets.set(iso, (buckets.get(iso) ?? 0) + n);

  // 1. LeetCode's official calendar (epoch-seconds keys at UTC midnight).
  const raw = snapshot?.rawMetadata as { submissionCalendar?: unknown } | null | undefined;
  const calendar = raw?.submissionCalendar;
  if (calendar && typeof calendar === "object") {
    for (const [key, value] of Object.entries(calendar as Record<string, unknown>)) {
      const epochSeconds = Number(key);
      const count = Number(value);
      if (!Number.isFinite(epochSeconds) || !Number.isFinite(count) || count <= 0) continue;
      const iso = isoDateOf(new Date(epochSeconds * 1000));
      if (new Date(`${iso}T00:00:00Z`).getTime() < windowStartMidnight) continue;
      add(iso, count);
    }
  }

  // 2. Locally synced solve dates (overlay on top of the official counts).
  for (const record of solved) {
    if (!record.solvedAt) continue;
    add(isoDateOf(record.solvedAt), 1);
  }

  const days = Array.from(buckets.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const totalSubmissions = days.reduce((acc, d) => acc + d.count, 0);

  // Longest streak over consecutive active days.
  let longestStreak = 0;
  let run = 0;
  let prevIso: string | null = null;
  for (const day of days) {
    const prev = prevIso ? new Date(`${prevIso}T00:00:00Z`).getTime() : null;
    const curr = new Date(`${day.date}T00:00:00Z`).getTime();
    run = prev !== null && curr - prev === 86_400_000 ? run + 1 : 1;
    prevIso = day.date;
    if (run > longestStreak) longestStreak = run;
  }

  // Current streak: walk back from today (or yesterday, so the in-progress day
  // does not reset the visible streak to zero).
  let currentStreak = 0;
  const todayIso = isoDateOf(now);
  const yesterdayIso = isoDateOf(new Date(now.getTime() - 86_400_000));
  let cursorIso = buckets.has(todayIso)
    ? todayIso
    : buckets.has(yesterdayIso)
      ? yesterdayIso
      : null;
  while (cursorIso && (buckets.get(cursorIso) ?? 0) > 0) {
    currentStreak += 1;
    const prev = new Date(new Date(`${cursorIso}T00:00:00Z`).getTime() - 86_400_000);
    cursorIso = buckets.has(isoDateOf(prev)) ? isoDateOf(prev) : null;
  }

  return {
    days,
    totalSubmissions,
    activeDays: days.length,
    currentStreak,
    longestStreak,
  };
}
