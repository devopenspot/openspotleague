"use client";

import { memo } from "react";
import { RadiusDistance } from "@/components/map/controls/RadiusDistance";
import { SwitchFilteredNearby } from "@/components/map/controls/SwitchFilteredNearby";

export function MapControlsBase() {
  return (
    <div
      role="toolbar"
      aria-label="Map controls"
      className="pointer-events-none absolute left-1/5 md:left-3 right-3 top-2 z-[1100] flex max-w-full flex-wrap gap-2 sm:right-auto"
    >
      <SwitchFilteredNearby />
      <RadiusDistance />
    </div>
  );
}

export const MapControls = memo(MapControlsBase);
