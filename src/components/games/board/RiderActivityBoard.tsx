"use client";

import { useEffect, useMemo, useState } from "react";
import type { RiderActivityDay } from "@/lib/services/profile/ranking";

export type RiderActivityData = {
  days: readonly RiderActivityDay[];
  error: boolean;
};

export function useRiderActivity(enabled = true): RiderActivityData {
  const [days, setDays] = useState<readonly RiderActivityDay[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    void fetch("/api/ranking/activity", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("activity unavailable");
        return response.json() as Promise<readonly RiderActivityDay[]>;
      })
      .then(setDays)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [enabled]);

  return { days, error };
}

export function activityTone(count: number, maximum: number) {
  if (count === 0) return "bg-activity-empty";
  if (count >= maximum * 0.9) return "bg-activity-peak";
  if (count >= maximum * 0.75) return "bg-activity-high";
  if (count >= maximum * 0.4) return "bg-activity-medium";
  return "bg-activity-low";
}

/* Dark-panel type: same scale as the LABEL / CARD_TITLE recipes, surface ink. */
const PANEL_LABEL =
  "font-display text-[10px] font-bold uppercase leading-tight tracking-label text-surface/60";
const PANEL = "@container min-w-0 rounded-container bg-on-surface p-4 text-surface sm:p-5";
const CELL = "aspect-square w-full rounded-[2px]";
const LEGEND_TONES = [
  "bg-activity-empty",
  "bg-activity-low",
  "bg-activity-medium",
  "bg-activity-high",
  "bg-activity-peak",
] as const;
/** Rows are Monday-first; label every other row so the gutter stays quiet. */
const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""] as const;

type GridCell = { day: RiderActivityDay; column: number; row: number };

export type ActivityLayout = {
  cells: GridCell[];
  columns: number;
  months: { label: string; column: number }[];
};

function parseDay(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

/**
 * Places each day on a Monday-first week grid. The API returns a rolling run
 * of days that can start on any weekday, so the first column is padded.
 */
export function layoutActivity(days: readonly RiderActivityDay[]): ActivityLayout {
  const first = days[0];
  if (!first) return { cells: [], columns: 0, months: [] };
  const offset = (parseDay(first.date).getUTCDay() + 6) % 7;
  const months: ActivityLayout["months"] = [];
  let lastMonth = -1;
  const cells = days.map((day, index) => {
    const slot = index + offset;
    const column = Math.floor(slot / 7);
    const row = slot % 7;
    const date = parseDay(day.date);
    const month = date.getUTCMonth();
    // Label a month on the first column that starts inside it.
    if (month !== lastMonth && (row === 0 || index === 0)) {
      if (index === 0 || date.getUTCDate() <= 7) {
        months.push({
          label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
          column,
        });
      }
      lastMonth = month;
    }
    return { day, column, row };
  });
  // A partial first month right before the next label would collide with it.
  const [head, next] = months;
  if (head && next && next.column - head.column < 2) months.shift();
  const lastCell = cells[cells.length - 1];
  return { cells, columns: (lastCell?.column ?? 0) + 1, months };
}

export type ActivitySummary = {
  events: number;
  points: number;
  activeDays: number;
  bestStreak: number;
};

export function summarizeActivity(days: readonly RiderActivityDay[]): ActivitySummary {
  let events = 0;
  let points = 0;
  let activeDays = 0;
  let streak = 0;
  let bestStreak = 0;
  for (const day of days) {
    events += day.count;
    points += day.points;
    if (day.count > 0) {
      activeDays += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }
  return { events, points, activeDays, bestStreak };
}

function plural(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`;
}

function dayLabel(day: RiderActivityDay) {
  const date = parseDay(day.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (day.count === 0) return `${date}: no activity`;
  return `${date}: ${plural(day.count, "event", "events")}, ${plural(day.points, "point", "points")}`;
}

function gridTemplate(columns: number) {
  return { gridTemplateColumns: `1.75rem repeat(${columns}, minmax(0, 1fr))` };
}

export function RiderActivityBoard({
  data,
  headingId = "rider-activity-title",
}: {
  data?: RiderActivityData;
  headingId?: string;
}) {
  const localData = useRiderActivity(data === undefined);
  const { days, error } = data ?? localData;

  const maximum = useMemo(
    () => Math.max(1, ...days.map((day) => day.count)),
    [days],
  );
  const layout = useMemo(() => layoutActivity(days), [days]);
  const summary = useMemo(() => summarizeActivity(days), [days]);
  const isEmpty = !error && days.length > 0 && summary.events === 0;

  return (
    <section className={PANEL} aria-labelledby={headingId}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={PANEL_LABEL}>Your activity</p>
          <h2
            id={headingId}
            className="mt-1 font-display text-lg font-bold uppercase leading-tight tracking-tight"
          >
            Last 12 weeks
          </h2>
        </div>
        {error ? <p className={PANEL_LABEL}>Unavailable</p> : null}
      </div>

      <dl
        className={`mt-4 grid grid-cols-2 gap-2 @md:grid-cols-4 ${error ? "opacity-40" : ""}`}
      >
        <PanelStat label="Events" value={summary.events} />
        <PanelStat label="Points" value={summary.points} />
        <PanelStat label="Active days" value={summary.activeDays} />
        <PanelStat label="Best streak" value={summary.bestStreak} unit="d" />
      </dl>

      <div className="relative mx-auto mt-4 w-full max-w-lg">
        {layout.columns > 0 ? (
          <div
            className="grid gap-1"
            style={gridTemplate(layout.columns)}
            role="img"
            aria-label={`Rider activity by day: ${plural(summary.activeDays, "active day", "active days")} in the last 12 weeks`}
          >
            {layout.months.map((month) => (
              <span
                key={`${month.label}-${month.column}`}
                className={`${PANEL_LABEL} whitespace-nowrap`}
                style={{ gridColumn: month.column + 2, gridRow: 1 }}
                aria-hidden="true"
              >
                {month.label}
              </span>
            ))}
            {WEEKDAY_LABELS.map((label, row) =>
              label ? (
                <span
                  key={label}
                  className={`${PANEL_LABEL} self-center`}
                  style={{ gridColumn: 1, gridRow: row + 2 }}
                  aria-hidden="true"
                >
                  {label}
                </span>
              ) : null,
            )}
            {layout.cells.map(({ day, column, row }) => (
              <span
                key={day.date}
                title={dayLabel(day)}
                className={`${CELL} ${activityTone(day.count, maximum)}`}
                style={{ gridColumn: column + 2, gridRow: row + 2 }}
              />
            ))}
          </div>
        ) : null}
        {isEmpty ? (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-card bg-on-surface/90 px-3 py-2 text-center text-sm font-semibold text-surface">
            No activity yet. Finish a game to light up your first day.
          </p>
        ) : null}
      </div>

      <div
        className={`mx-auto mt-3 flex w-full max-w-lg items-center justify-end gap-1.5 ${PANEL_LABEL}`}
        aria-hidden="true"
      >
        <span className="mr-1">Less</span>
        {LEGEND_TONES.map((tone) => (
          <i key={tone} className={`h-3 w-3 rounded-[2px] ${tone}`} />
        ))}
        <span className="ml-1">More</span>
      </div>
    </section>
  );
}

function PanelStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 rounded-card border border-surface/15 bg-surface/5 px-3 py-2.5 @md:flex-col @md:items-start @md:justify-start">
      <dt className={`${PANEL_LABEL} truncate`}>{label}</dt>
      <dd className="shrink-0 @md:mt-1 font-display text-xl font-bold leading-none tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-sm text-surface/60">{unit}</span> : null}
      </dd>
    </div>
  );
}

/** Loading mirror: same frame, stats row and 12-week grid as the board. */
export function RiderActivityBoardSkeleton() {
  return (
    <div aria-hidden="true" className={PANEL}>
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded-control bg-white/15" />
        <div className="h-5 w-36 animate-pulse rounded-control bg-white/20" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 @md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-card bg-white/10 @md:h-14" />
        ))}
      </div>
      <div className="mx-auto mt-4 w-full max-w-lg">
        <div className="grid gap-1" style={gridTemplate(12)}>
          <span style={{ gridColumn: 1, gridRow: 1 }} className="h-3" />
          {Array.from({ length: 84 }).map((_, i) => (
            <span
              key={i}
              className={`${CELL} bg-white/10`}
              style={{ gridColumn: Math.floor(i / 7) + 2, gridRow: (i % 7) + 2 }}
            />
          ))}
        </div>
      </div>
      <div className="mx-auto mt-3 flex w-full max-w-lg justify-end gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <i key={i} className="h-3 w-3 rounded-[2px] bg-white/10" />
        ))}
      </div>
    </div>
  );
}
