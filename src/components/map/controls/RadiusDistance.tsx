"use client";

import { memo, useCallback, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

import { useUserLocation } from "@/hooks/map/useUserLocation";

import { useDistanceUnit } from "@/hooks/preferences/useDistanceUnit";

import { formatRadiusLabel } from "@/lib/spots/geo";
import type { NearbyRadiusMiles } from "@/stores/user-location-store";
import { useMapMode } from "@/components/map/hooks/use-map-mode";

type Mode = "nearby" | "filtered" | "saved";

function RadiusDistanceBase() {
  const mapMode = useMapMode();
  const distanceUnit = useDistanceUnit();
  const { status, location, radiusMiles, radiusOptions, setRadiusMiles } =
    useUserLocation();
  const radiusButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const mode: Mode = mapMode;
  const hasLocation = status === "granted" && location !== null;

  const handleRadiusChip = useCallback(
    (miles: NearbyRadiusMiles) => {
      setRadiusMiles(miles);
    },
    [setRadiusMiles],
  );

  const showRadius = mode === "nearby" && hasLocation;
  const handleRadiusKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = radiusOptions.indexOf(radiusMiles);
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % radiusOptions.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex =
          (currentIndex - 1 + radiusOptions.length) % radiusOptions.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = radiusOptions.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      const nextRadius = radiusOptions[nextIndex];
      if (nextRadius === undefined) return;
      handleRadiusChip(nextRadius);
      radiusButtonRefs.current[nextIndex]?.focus();
    },
    [handleRadiusChip, radiusMiles, radiusOptions],
  );

  if (!showRadius) return null;

  return (
    <div
      id="map-controls"
      className="pointer-events-auto min-w-0 max-w-full overflow-x-auto rounded-full border border-outline-variant bg-surface/95"
    >
      <div
        role="radiogroup"
        aria-label={`Nearby radius in ${distanceUnit === "km" ? "kilometers" : "miles"}`}
        className="flex w-max min-w-full flex-nowrap items-center"
      >
        {radiusOptions.map((miles, idx) => {
          const active = miles === radiusMiles;
          const chipLabel = formatRadiusLabel(miles, distanceUnit);
          return (
            <button
              ref={(element) => {
                radiusButtonRefs.current[idx] = element;
              }}
              key={miles}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => handleRadiusChip(miles)}
              onKeyDown={handleRadiusKeyDown}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1.5 px-3 font-display text-[10px] font-bold tracking-widest uppercase transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                idx > 0 && "border-l border-outline-variant",
                active
                  ? "bg-primary text-on-primary"
                  : "text-on-surface hover:text-secondary hover:bg-surface-container",
              )}
            >
              {chipLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const RadiusDistance = memo(RadiusDistanceBase);
