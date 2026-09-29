import { Flame, CalendarDays } from "lucide-react";
import type { ActivityDay, CombinedActivity } from "@/lib/services/activity";

/**
 * Pure presentational heatmap — imports TYPES ONLY from the activity service so
 * this component stays free of server-only dependencies (prisma) and can be
 * rendered from both server pages and client containers.
 */

const WEEKS_SHOWN = 53; // Full 1-year window, GitHub-style

const LEVEL_CLASSES = [
  "bg-slate-800",
  "bg-cnOrange-900/70",
  "bg-cnOrange-700",
  "bg-cnOrange-600",
  "bg-cnOrange-500",
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
  iso: string | null;
  day?: ActivityDay;
}

function buildColumns(days: ActivityDay[], todayIso: string): HeatmapCell[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = new Date(`${todayIso}T00:00:00Z`);
  const start = new Date(today.getTime() - (WEEKS_SHOWN * 7 - 1) * 86_400_000);

  // Align the first column to Monday (GitHub-style layout).
  const startDay = start.getUTCDay(); // 0 = Sunday
  const leadPad = (startDay + 6) % 7; // blanks before the first Monday

  const cells: HeatmapCell[] = [];
  for (let i = 0; i < leadPad; i++) cells.push({ iso: null });
  for (let i = 0; i < WEEKS_SHOWN * 7 - leadPad; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const iso = isoDate(d);
    cells.push({ iso, day: iso <= todayIso ? byDate.get(iso) : undefined });
  }

  const columns: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));
  return columns;
}

function monthLabels(columns: HeatmapCell[][]): (string | null)[] {
  const labels: (string | null)[] = [];
  let lastMonth = -1;
  for (const column of columns) {
    const first = column.find((c) => c.iso !== null)?.iso;
    if (!first) {
      labels.push(null);
      continue;
    }
    const month = new Date(`${first}T00:00:00Z`).getUTCMonth();
    labels.push(month !== lastMonth ? MONTH_NAMES[month] : null);
    lastMonth = month;
  }
  return labels;
}

function tooltipFor(day: ActivityDay): string {
  return `${day.count} problem${day.count === 1 ? "" : "s"} solved on ${day.date}`;
}

/** GitHub-style activity heatmap of verified LeetCode solves (last 1 year). */
export function ActivityHeatmap({ activity }: { activity: CombinedActivity }) {
  const todayIso = isoDate(new Date());
  const columns = buildColumns(activity.days, todayIso);
  const labels = monthLabels(columns);

  return (
    <div className="space-y-4">
      <div className="p-4 bg-slateDark-900/90 rounded-xl border border-slate-800 overflow-x-auto custom-scrollbar">
        <div className="min-w-[900px]">
          {/* Month labels row */}
          <div className="flex gap-1 mb-1.5 pl-0.5">
            {labels.map((label, i) => (
              <div key={i} className="w-3 text-[9px] text-slate-500 font-medium whitespace-nowrap">
                {label ?? ""}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div className="flex gap-1">
            {columns.map((column, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                {column.map((cell, ri) =>
                  cell.iso === null ? (
                    <div key={ri} className="w-3 h-3 rounded-sm" />
                  ) : (
                    <div
                      key={ri}
                      className={`w-3 h-3 rounded-sm transition-transform hover:scale-125 ${
                        LEVEL_CLASSES[levelForCount(cell.day?.count ?? 0)]
                      }`}
                      title={cell.day ? tooltipFor(cell.day) : `No submissions on ${cell.iso}`}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-cnOrange-500" />
            <span>
              Current streak: <strong className="text-white">{activity.currentStreak}d</strong>
              {" · "}Best: <strong className="text-white">{activity.longestStreak}d</strong>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Active days: <strong className="text-white">{activity.activeDays}</strong>
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

      <p className="text-[10px] text-slate-500">
        Verified LeetCode activity over the last 1 year, synced automatically
        from your accepted submissions.
      </p>
    </div>
  );
}
