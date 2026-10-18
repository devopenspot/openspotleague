"use client";

import { useMapLayer } from "@/hooks/map/useMapLayer";
import { cn } from "@/lib/utils/cn";
import type { MapLayer } from "@/lib/schemas/event";

interface Option {
  value: MapLayer;
  label: string;
}

const OPTIONS: readonly Option[] = [
  { value: "spots", label: "Spots" },
  //   { value: "events", label: "Events" },
];

interface LayerToggleProps {
  spotCount?: number;
  eventCount?: number;
}

export function LayerToggle({ spotCount, eventCount }: LayerToggleProps) {
  const { enabled, isEnabled, toggle } = useMapLayer();

  const getCount = (value: MapLayer): number | undefined => {
    if (value === "spots") return spotCount;
    if (value === "events") return eventCount;
    return undefined;
  };

  return (
    <div
      id="map-layer-toggle"
      role="group"
      aria-label="Map layers"
      className="pointer-events-auto z-[1100] h-11 flex items-stretch overflow-hidden rounded-full border border-outline-variant bg-surface/95"
    >
      {OPTIONS.map((opt, idx) => {
        const active = isEnabled(opt.value);
        const count = getCount(opt.value);
        const countLabel =
          typeof count === "number" ? `${opt.label}, ${count}` : opt.label;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            aria-label={countLabel}
            disabled={active && enabled.size <= 1}
            title={
              active && enabled.size <= 1
                ? "At least one map layer must remain visible"
                : undefined
            }
            onClick={() => toggle(opt.value)}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 px-3 font-display text-[10px] font-bold tracking-widest uppercase transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60",
              idx > 0 && "border-l border-outline-variant",
              active
                ? "bg-primary text-on-primary"
                : "text-secondary hover:text-on-surface hover:bg-surface-container",
            )}
          >
            <span>{opt.label}</span>
            {typeof count === "number" && (
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 font-display text-[10px] font-bold tabular-nums leading-none",
                  active
                    ? "bg-on-primary/15 text-on-primary"
                    : "bg-surface-container-high text-secondary",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
