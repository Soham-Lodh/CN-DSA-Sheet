/** Sum of a numeric field across a list. */
export function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

/** Average like 73.333... -> 73.3 (one decimal). 0 when the denominator is 0. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/** Tailwind classes for difficulty badges, shared by sheet & admin tables. */
export const difficultyClasses: Record<string, string> = {
  EASY: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  HARD: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  UNKNOWN: "text-slate-400 bg-slate-800 border-slate-700",
};
