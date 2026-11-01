"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";

import { MapPin, FilterIcon } from "lucide-react";
import { useMapActions } from "@/components/map/hooks/use-map-actions";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { showToast } from "@/hooks/ui/useToast";
import { cn } from "@/lib/utils/cn";
import { useMapMode } from "@/components/map/hooks/use-map-mode";

const modes = ["filtered", "nearby", "saved"] as const;

export function SwitchFilteredNearby() {
  const mapMode = useMapMode();
  const { selectMode } = useMapActions();
  const { status, location, request } = useUserLocation();
  const modeButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isRequesting = status === "requesting";
  const hasLocation = status === "granted" && location !== null;
  const handleFilteredClick = useCallback(() => {
    selectMode("filtered");
  }, [selectMode]);

  const handleModeChange = useCallback(
    async (next: (typeof modes)[number]) => {
      if (next !== "nearby") {
        selectMode(next);
        return;
      }

      if (hasLocation) {
        selectMode(next);
        return;
      }

      const result = await request();
      if (result === "denied") {
        showToast(
          "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again.",
          "error",
        );
      } else if (result === "unavailable") {
        showToast("Location unavailable. Showing all spots.", "error");
      }
      selectMode(next);
    },
    [hasLocation, request, selectMode],
  );

  const handleModeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = modes.indexOf(mapMode);
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % modes.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + modes.length) % modes.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = modes.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      const nextMode = modes[nextIndex];
      if (!nextMode) return;
      void handleModeChange(nextMode);
      modeButtonRefs.current[nextIndex]?.focus();
    },
    [handleModeChange, mapMode],
  );

  return (
    <div
      id="map-mode-switcher"
      className="pointer-events-auto flex min-w-64 items-stretch overflow-hidden rounded-lg border-2 border-outline-variant bg-surface/95"
    >
      <div
        role="radiogroup"
        aria-label="Map mode"
        className="flex min-w-0 flex-1 items-stretch"
      >
        <button
          ref={(element) => {
            modeButtonRefs.current[0] = element;
          }}
          type="button"
          role="radio"
          aria-checked={mapMode === "filtered"}
          tabIndex={mapMode === "filtered" ? 0 : -1}
          onClick={handleFilteredClick}
          onKeyDown={handleModeKeyDown}
          className={cn(
            "flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 font-display text-sm font-bold tracking-[0.04em] uppercase transition-colors sm:px-3",
            "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
            mapMode === "filtered"
              ? "bg-primary text-on-primary"
              : "text-on-surface hover:text-secondary hover:bg-surface-container",
          )}
        >
          <FilterIcon
            size={14}
            aria-hidden="true"
            className="hidden shrink-0 sm:block"
          />
          <span>Filtered</span>
        </button>
        <button
          ref={(element) => {
            modeButtonRefs.current[1] = element;
          }}
          type="button"
          role="radio"
          aria-checked={mapMode === "nearby"}
          tabIndex={mapMode === "nearby" ? 0 : -1}
          onClick={() => void handleModeChange("nearby")}
          disabled={isRequesting}
          aria-busy={isRequesting}
          onKeyDown={handleModeKeyDown}
          className={cn(
            "flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 border-l border-outline-variant px-2 font-display text-sm font-bold tracking-[0.04em] uppercase transition-colors sm:px-3",
            "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
            mapMode === "nearby"
              ? "bg-primary text-on-primary"
              : "text-on-surface hover:text-secondary hover:bg-surface-container",
          )}
        >
          <MapPin
            size={14}
            aria-hidden="true"
            className="hidden shrink-0 sm:block"
          />
          <span>Nearby</span>
        </button>
      </div>
    </div>
  );
}
