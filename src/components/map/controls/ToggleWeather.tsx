"use client";

import { memo, useCallback } from "react";
import { useMapStore } from "@/stores/map-store";
import { cn } from "@/lib/utils/cn";

function ToggleWeatherBase() {
  const showWeather = useMapStore((s) => s.isWeatherEnabled);
  const isRequesting = useMapStore((s) => s.isWeatherFetching);
  const toggleWeatherEnabled = useMapStore((s) => s.toggleWeatherEnabled);

  const handleToggle = useCallback(() => {
    toggleWeatherEnabled();
  }, [toggleWeatherEnabled]);

  return (
    <div className="pointer-events-none h-11 overflow-hidden rounded-full border border-outline-variant bg-surface/95">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isRequesting}
        aria-busy={isRequesting}
        aria-pressed={showWeather}
        title={isRequesting ? "Weather is loading" : undefined}
        className={cn(
          "pointer-events-auto inline-flex h-full items-center gap-1.5 px-3 font-display text-[10px] font-bold tracking-widest uppercase transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-wait disabled:opacity-60",
          showWeather
            ? "bg-primary text-on-primary"
            : "text-secondary hover:text-on-surface hover:bg-surface-container",
        )}
      >
        <span>{isRequesting ? "Loading…" : "Weather"}</span>
      </button>
    </div>
  );
}

export const ToggleWeather = memo(ToggleWeatherBase);
