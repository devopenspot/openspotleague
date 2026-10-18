"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  buildStatusFilterUrl,
  useEventStatusFilter,
} from "@/lib/sport-events/status-filter";
import type { SportEventEnriched } from "@/types/sport-events";

interface StatusFilterProps {
  events: readonly SportEventEnriched[];
}

type StatusValue = "all" | "live" | "upcoming" | "completed";

interface StatusTile {
  value: StatusValue;
  label: string;
  count: number;
  dotClass: string;
}

const TILE_ORDER: readonly StatusValue[] = [
  "all",
  "live",
  "upcoming",
  "completed",
];

export function StatusFilter({ events }: StatusFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status: current } = useEventStatusFilter();

  const setStatus = (next: StatusValue) => {
    if (next === current) return;
    const url = buildStatusFilterUrl(pathname, searchParams, next);
    router.replace(url, { scroll: false });
  };

  const tiles = useMemo<readonly StatusTile[]>(() => {
    const counts = events.reduce(
      (acc, event) => {
        acc[event.status] += 1;
        return acc;
      },
      { live: 0, upcoming: 0, completed: 0 },
    );
    const byValue: Record<StatusValue, StatusTile> = {
      all: {
        value: "all",
        label: "All",
        count: events.length,
        dotClass: "bg-on-surface",
      },
      live: {
        value: "live",
        label: "Live",
        count: counts.live,
        dotClass: "bg-error",
      },
      upcoming: {
        value: "upcoming",
        label: "Upcoming",
        count: counts.upcoming,
        dotClass: "bg-on-surface",
      },
      completed: {
        value: "completed",
        label: "Past",
        count: counts.completed,
        dotClass: "bg-outline",
      },
    };
    return TILE_ORDER.map((value) => byValue[value]);
  }, [events]);

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-2xl font-bold tracking-tight text-on-surface uppercase sm:text-3xl">
          Sport Events
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
          The circuit that defines the season. World tours, federations, and
          festivals — the official stages where action sports happen. Tap any
          card to open the organizer&apos;s site.
        </p>
      </div>

      <dl
        aria-label="Filter events by status"
        className="grid grid-cols-4 gap-1.5 self-start rounded-[16px] border border-outline-variant bg-surface-container-low p-1.5 sm:self-end"
      >
        {tiles.map((tile) => {
          const active = current === tile.value;
          return (
            <StatusStat
              key={tile.value}
              label={tile.label}
              value={tile.count}
              dotClass={tile.dotClass}
              active={active}
              onClick={() => setStatus(tile.value)}
            />
          );
        })}
      </dl>
    </div>
  );
}

interface StatusStatProps {
  label: string;
  value: number;
  dotClass: string;
  active: boolean;
  onClick: () => void;
}

function StatusStat({
  label,
  value,
  dotClass,
  active,
  onClick,
}: StatusStatProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "truncate flex max-h-18 md:max-h-20 min-w-0 flex-col items-start gap-1.5 rounded-[16px] px-2 py-3 transition-[background-color,color,transform] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:min-w-[90px] sm:px-4",
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            active ? "bg-on-primary" : dotClass,
          )}
        />
        <h2 className="font-display text-xs font-bold tracking-widest uppercase truncate">
          {label}
        </h2>
      </div>
      <dd className="font-display text-xl font-bold tracking-tight">
        {value.toString().padStart(2, "0")}
      </dd>
    </button>
  );
}
