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
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <section
      className="min-w-0 rounded-[16px] bg-on-surface p-3.5 text-surface sm:p-4"
      aria-labelledby={headingId}
    >
      <div className="flex flex-col items-start gap-1 pb-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div>
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-surface/60">
            Registered rider activity
          </p>
          <h2
            id={headingId}
            className="mt-1 font-display text-base font-bold uppercase leading-tight sm:text-lg"
          >
            Your last 12 weeks
          </h2>
        </div>
        <p className="font-display text-[11px] uppercase leading-none tracking-[0.06em] text-surface/60">
          {error ? "Unavailable" : `${total} score events`}
        </p>
      </div>
      <div className="mt-3 w-full min-w-0 overflow-hidden pb-1 sm:mt-3">
        <div
          className="grid min-h-24 w-full min-w-0 auto-cols-fr grid-flow-col grid-rows-7 place-items-center gap-1"
          aria-label="Rider activity by day"
        >
          {days.map((day) => (
            <span
              key={day.date}
              title={`${day.date}: ${day.count} events, ${day.points} points`}
              aria-label={`${day.date}: ${day.count} activity events, ${day.points} points`}
              className={`aspect-square w-2.5 max-w-full rounded-[2px] ${activityTone(day.count, maximum)} sm:w-3`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 font-display text-[11px] uppercase tracking-[0.06em] text-surface/60 sm:gap-3">
        <span>Less</span>
        <span className="flex gap-1" aria-hidden="true">
          <i className="h-2.5 w-2.5 rounded-[2px] bg-activity-empty sm:h-3 sm:w-3" />
          <i className="h-2.5 w-2.5 rounded-[2px] bg-activity-low sm:h-3 sm:w-3" />
          <i className="h-2.5 w-2.5 rounded-[2px] bg-activity-medium sm:h-3 sm:w-3" />
          <i className="h-2.5 w-2.5 rounded-[2px] bg-activity-high sm:h-3 sm:w-3" />
          <i className="h-2.5 w-2.5 rounded-[2px] bg-activity-peak sm:h-3 sm:w-3" />
        </span>
        <span>More</span>
      </div>
    </section>
  );
}

export function RiderActivityBoardSkeleton() {
  return (
    <div aria-hidden="true" className="min-w-0 rounded-[16px] bg-on-surface p-3.5 sm:p-4 animate-pulse">
      <div className="flex flex-col gap-1 pb-2.5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-surface/20" />
          <div className="h-5 w-36 rounded bg-surface/20" />
        </div>
        <div className="h-3 w-24 rounded bg-surface/20" />
      </div>
      <div className="mt-3 grid min-h-24 auto-cols-fr grid-flow-col grid-rows-7 place-items-center gap-1">
        {Array.from({ length: 84 }).map((_, i) => (
          <span key={i} className="aspect-square w-2.5 rounded-[2px] bg-surface/15 sm:w-3" />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="h-3 w-8 rounded bg-surface/15" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <i key={i} className="h-2.5 w-2.5 rounded-[2px] bg-surface/15 sm:h-3 sm:w-3" />
          ))}
        </div>
        <div className="h-3 w-8 rounded bg-surface/15" />
      </div>
    </div>
  );
}
