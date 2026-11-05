"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BODY, CARD, EYEBROW, PAGE_TITLE } from "@/components/ui/recipes";
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
    <div className={`${CARD} text-on-surface sm:p-6`}>
      <div className="border-b border-outline-variant pb-4">
        <p className={EYEBROW}>
          Official &amp; community circuit
        </p>
        <h2 className={`mt-1 ${PAGE_TITLE} text-on-surface`}>
          Sport Events
        </h2>
        <p className={`mt-2 max-w-2xl ${BODY}`}>
          The circuit that defines the season. World tours, federations, and
          festivals — the official stages where action sports happen. Tap any
          card to open the organizer&apos;s site.
        </p>
      </div>

      <dl
        aria-label="Filter events by status"
        className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
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
        "flex min-w-0 flex-col items-start justify-between rounded-card border px-3.5 py-3 text-left transition-[background-color,border-color,color,transform] active:translate-y-px focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-outline-variant bg-surface-container text-on-surface hover:border-on-surface hover:bg-surface-container-high",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <dd className="font-display text-2xl font-bold leading-none tabular-nums">
          {value.toString().padStart(2, "0")}
        </dd>
        <span
          aria-hidden="true"
          className={cn(
            "h-2 w-2 shrink-0 rounded-control",
            active ? "bg-on-primary" : dotClass,
          )}
        />
      </div>
      <dt
        className={cn(
          "mt-2 truncate font-display text-xs font-bold uppercase leading-tight tracking-label",
          active ? "text-on-primary/85" : "text-secondary",
        )}
      >
        {label}
      </dt>
    </button>
  );
}
