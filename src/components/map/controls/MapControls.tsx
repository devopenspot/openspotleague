"use client";

import { memo } from "react";

// import { CheckDistance } from "@/components/map/controls/CheckDistance";
// import { ToggleWeather } from "@/components/map/controls/ToggleWeather";
import { RadiusDistance } from "@/components/map/controls/RadiusDistance";
import { LayerToggle } from "@/components/map/markers/LayerToggle";
import { SwitchFilteredNearby } from "@/components/map/controls/SwitchFilteredNearby";

interface MapControlsProps {
  isSidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  spotCount?: number;
  eventCount?: number;
}

function MapControlsBase({ spotCount, eventCount }: MapControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Map controls"
      className="pointer-events-none absolute left-3 right-3 top-2 z-[1100] flex max-w-full flex-wrap gap-2 sm:right-auto"
    >
      <div className="hidden">
        <LayerToggle spotCount={spotCount} eventCount={eventCount} />
      </div>
      <SwitchFilteredNearby />
      <RadiusDistance />
      {/* <CheckDistance /> */}
      {/* <ToggleWeather /> */}
    </div>
  );
}

export const MapControls = memo(MapControlsBase);
