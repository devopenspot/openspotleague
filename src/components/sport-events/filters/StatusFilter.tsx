"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SEGMENTED_TRACK, segmentClass } from "@/components/ui/recipes";
import { cn } from "@/lib/utils/cn";
import {
  buildStatusFilterUrl,
  useEventStatusFilter,
} from "@/lib/league/status-filter";
import type { ContestEnriched } from "@/types/league";

interface StatusFilterProps {
  events: readonly ContestEnriched[];
}

type StatusValue = "all" | "live" | "upcoming" | "completed";

interface StatusSegment {
  value: StatusValue;
  label: string;
  count: number;
}

const SEGMENT_LABEL: Record<StatusValue, string> = {
  all: "All",
  live: "Live",
  upcoming: "Upcoming",
  completed: "Past",
};

const SEGMENT_ORDER: readonly StatusValue[] = [
  "all",
  "live",
  "upcoming",
  "completed",
];

/**
 * Status filter: a segmented pill track (DESIGN.md components.controls.segments).
 * The URL is the source of truth; empty statuses are hidden unless active.
 */
export function StatusFilter({ events }: StatusFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status: current } = useEventStatusFilter();

  const setStatus = (next: StatusValue) => {
    if (next === current) return;
    const url = buildStatusFilterUrl(
      pathname,
      new URLSearchParams(searchParams.toString()),
      next,
    );
    router.replace(url, { scroll: false });
  };

  const segments = useMemo<readonly StatusSegment[]>(() => {
    const counts: Record<StatusValue, number> = {
      all: events.length,
      live: 0,
      upcoming: 0,
      completed: 0,
    };
    for (const event of events) counts[event.status] += 1;
    return SEGMENT_ORDER.filter(
      (value) => value === "all" || value === current || counts[value] > 0,
    ).map((value) => ({
      value,
      label: SEGMENT_LABEL[value],
      count: counts[value],
    }));
  }, [events, current]);

  return (
    <div
      role="group"
      aria-label="Filter events by status"
      className={cn(SEGMENTED_TRACK, "w-full sm:w-auto")}
    >
      {segments.map((segment) => {
        const active = current === segment.value;
        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={active}
            onClick={() => setStatus(segment.value)}
            className={segmentClass(active)}
          >
            {segment.value === "live" ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-control",
                  active ? "bg-on-primary" : "bg-error",
                )}
              />
            ) : null}
            {segment.label}
            <span
              className={cn(
                "tabular-nums",
                active ? "text-on-primary/70" : "text-secondary",
              )}
            >
              {segment.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
