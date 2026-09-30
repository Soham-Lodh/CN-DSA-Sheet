import { Flame, CalendarDays } from "lucide-react";
import type { ActivityDay, CombinedActivity } from "@/lib/services/activity";

/**
 * Pure presentational heatmap — imports TYPES ONLY from the activity service so
 * this component stays free of server-only dependencies (prisma) and can be
 * rendered from both server pages and client containers.
 */

const MONTHS_SHOWN = 12;

const LEVEL_CLASSES = [
  "bg-surface-elevated",
  "bg-brand-glow",
  "bg-brand-hover",
  "bg-brand-accent",
  "bg-brand-primary",
] as const;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function levelForCount(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface HeatmapCell {
  iso: string;
  day?: ActivityDay;
}

interface HeatmapMonth {
  label: string;
  columns: HeatmapCell[][];
}

function buildMonths(days: ActivityDay[], todayIso: string): HeatmapMonth[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = new Date(`${todayIso}T00:00:00Z`);

  return Array.from({ length: MONTHS_SHOWN }, (_, monthOffset) => {
    const month = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (MONTHS_SHOWN - 1 - monthOffset), 1),
    );
    const monthIndex = month.getUTCMonth();
    const daysInMonth = new Date(
      Date.UTC(month.getUTCFullYear(), monthIndex + 1, 0),
    ).getUTCDate();
    const leadingCells = (month.getUTCDay() + 6) % 7; // Monday-first
    const columnCount = Math.ceil((leadingCells + daysInMonth) / 7);
    const cells: HeatmapCell[] = [];

    for (let cellIndex = 0; cellIndex < columnCount * 7; cellIndex++) {
      const dayOfMonth = cellIndex - leadingCells + 1;
      const date = new Date(
        Date.UTC(month.getUTCFullYear(), monthIndex, dayOfMonth),
      );
      const iso = isoDate(date);
      const belongsToMonth = dayOfMonth >= 1 && dayOfMonth <= daysInMonth;

      cells.push({
        iso,
        day: belongsToMonth && iso <= todayIso ? byDate.get(iso) : undefined,
      });
    }

    const columns: HeatmapCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

    return { label: MONTH_NAMES[monthIndex], columns };
  });
}

function tooltipFor(day: ActivityDay): string {
  return `${day.count} problem${day.count === 1 ? "" : "s"} solved on ${day.date}`;
}

/** LeetCode-style monthly activity heatmap of verified solves (last 12 months). */
export function ActivityHeatmap({ activity }: { activity: CombinedActivity }) {
  const todayIso = isoDate(new Date());
  const months = buildMonths(activity.days, todayIso);

  return (
    <div className="space-y-4">
      <div className="w-fit max-w-full p-4 bg-surface-base/90 rounded-xl border border-outline-subtle overflow-x-auto custom-scrollbar">
        {/* Each month is an independent calendar block, matching LeetCode's layout. */}
        <div className="w-max flex items-start gap-4">
          {months.map((month) => (
            <div key={month.label} className="flex flex-col items-center gap-2">
              <div className="flex gap-1">
                {month.columns.map((column, ci) => (
                  <div key={ci} className="flex flex-col gap-1">
                    {column.map((cell, ri) => {
                      const isCurrentMonth = new Date(`${cell.iso}T00:00:00Z`).getUTCMonth() ===
                        MONTH_NAMES.indexOf(month.label);

                      return (
                        <div
                          key={ri}
                          className={`w-3 h-3 rounded-sm transition-transform hover:scale-125 ${
                            isCurrentMonth
                              ? LEVEL_CLASSES[levelForCount(cell.day?.count ?? 0)]
                              : "bg-transparent"
                          }`}
                          title={
                            isCurrentMonth
                              ? cell.day
                                ? tooltipFor(cell.day)
                                : `No submissions on ${cell.iso}`
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <span className="text-xs text-content-secondary font-medium">
                {month.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-content-secondary">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-brand-primary" />
            <span>
              Current streak: <strong className="text-content-primary">{activity.currentStreak}d</strong>
              {" · "}Best: <strong className="text-content-primary">{activity.longestStreak}d</strong>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-content-muted" />
            <span>
              Active days: <strong className="text-content-primary">{activity.activeDays}</strong>
              {" · "}
              {activity.totalSubmissions} submissions
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>Less</span>
          {LEVEL_CLASSES.map((cls, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <p className="text-[10px] text-content-muted">
        Verified LeetCode activity over the last 1 year, synced automatically
        from your accepted submissions.
      </p>
    </div>
  );
}
