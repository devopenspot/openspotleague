"use client";

import { memo, useCallback, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { chipClass, controlClass, META } from "@/components/ui/recipes";
import { useDistanceUnit } from "@/hooks/preferences/useDistanceUnit";
import { formatRadiusLabel } from "@/lib/spots/geo";
import {
  AROUND_RADIUS_OPTIONS,
  type AroundRadiusMiles,
} from "@/lib/spots/back-to-map";

export interface MapAreaBarProps {
  spotName: string;
  count: number;
  loading: boolean;
  aroundMiles: AroundRadiusMiles;
  onSelectRadius: (miles: AroundRadiusMiles) => void;
  /** Open the focused spot's popup (phones arrive without it). */
  onShowSpot: () => void;
  /** Back to the plain city filter; omitted when the spot has no city. */
  cityName: string | null;
  onlyCityHref: string | null;
  className?: string;
}

function spotCountLabel(count: number, loading: boolean): string {
  if (loading && count <= 1) return "Finding spots…";
  return count === 1 ? "1 spot" : `${count} spots`;
}

/**
 * "Explore around this spot" bar for the map's focus deep link
 * (`/map?…&spot=<id>&around=<miles>`): what is shown, a radius picker
 * and a way back to the spot's city filter.
 */
function MapAreaBarBase({
  spotName,
  count,
  loading,
  aroundMiles,
  onSelectRadius,
  onShowSpot,
  cityName,
  onlyCityHref,
  className,
}: MapAreaBarProps) {
  const distanceUnit = useDistanceUnit();
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const current = AROUND_RADIUS_OPTIONS.indexOf(aroundMiles);
      const last = AROUND_RADIUS_OPTIONS.length - 1;
      let next: number;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = current === last ? 0 : current + 1;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = current === 0 ? last : current - 1;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = last;
      } else {
        return;
      }
      event.preventDefault();
      const miles = AROUND_RADIUS_OPTIONS[next];
      if (miles === undefined) return;
      onSelectRadius(miles);
      chipRefs.current[next]?.focus();
    },
    [aroundMiles, onSelectRadius],
  );

  return (
    <div
      role="group"
      aria-label={`Spots around ${spotName}`}
      // Taps here must not close the map popup (MapInfoPopup outside-click).
      data-map-keep-popup=""
      className={cn(
        "w-[min(100%,26rem)] rounded-container border border-outline-variant bg-surface/95 p-3 backdrop-blur-sm",
        className,
      )}
    >
      <p className={cn(META, "truncate")}>
        <span>
          Around{" "}
          <button
            type="button"
            onClick={onShowSpot}
            aria-label={`Show ${spotName} details`}
            className="text-on-surface underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {spotName}
          </button>
        </span>
        <span aria-hidden="true"> · </span>
        <span aria-live="polite" className="tabular-nums text-on-surface">
          {spotCountLabel(count, loading)}
        </span>
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Distance around the spot"
          className="flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar"
        >
          {AROUND_RADIUS_OPTIONS.map((miles, index) => {
            const checked = miles === aroundMiles;
            return (
              <button
                key={miles}
                ref={(el) => {
                  chipRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                onClick={() => onSelectRadius(miles)}
                onKeyDown={handleKeyDown}
                className={chipClass(checked)}
              >
                {formatRadiusLabel(miles, distanceUnit)}
              </button>
            );
          })}
        </div>
        {cityName && onlyCityHref && (
          <Link
            href={onlyCityHref}
            className={cn(controlClass("outline", "sm"), "ml-auto")}
            aria-label={`Show only spots in ${cityName}`}
          >
            <Building2 size={12} aria-hidden="true" />
            <span className="max-w-[9rem] truncate">Only {cityName}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export const MapAreaBar = memo(MapAreaBarBase);
