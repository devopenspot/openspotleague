"use client";

import { memo, useCallback } from "react";
import { showToast } from "@/hooks/ui/useToast";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useMapActions } from "@/components/map/hooks/use-map-actions";
import { LocationLed } from "@/components/ui/LocationLed";
import { cn } from "@/lib/utils/cn";
import type {
  UserLocationError,
  UserLocationStatus,
} from "@/stores/user-location-store";

function distanceStatusLabel(
  status: UserLocationStatus,
  hasLocation: boolean,
  error: UserLocationError | null,
): string {
  if (hasLocation) return "Stop using location on this map.";
  if (status === "requesting") return "Requesting your location.";
  if (status === "denied") {
    return "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again.";
  }
  if (status === "unavailable") return unavailableMessage(error);
  return "Use your location to find nearby spots.";
}

function distanceButtonLabel(
  status: UserLocationStatus,
  hasLocation: boolean,
): string {
  if (hasLocation) return "Location";
  if (status === "requesting") return "Locating...";
  if (status === "denied") return "Fix location";
  return "Distance";
}

function unavailableMessage(error: UserLocationError | null): string {
  switch (error) {
    case "insecure-context":
      return "Location requires a secure connection.";
    case "unsupported":
      return "Location is unavailable in this browser or page context.";
    case "timeout":
      return "Location lookup timed out. Try again where you have a clearer signal.";
    case "position-unavailable":
      return "Your location is temporarily unavailable. Try again.";
    default:
      return "Your location is temporarily unavailable. Try again.";
  }
}

function CheckDistanceBase() {
  const { status, location, error, request } = useUserLocation();
  const { clearLocationAndNearby } = useMapActions();
  const hasLocation = status === "granted" && location !== null;
  const isRequesting = status === "requesting";

  const handleToggle = useCallback(async () => {
    if (isRequesting) return;
    if (hasLocation) {
      clearLocationAndNearby();
      showToast("Location cleared — showing global grid.", "info");
      return;
    }
    const next = await request();
    if (next === "denied") {
      showToast(
        "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again.",
        "error",
      );
    } else if (next === "unavailable") {
      showToast(unavailableMessage(error), "error");
    } else if (next === "granted") {
      showToast("Distance ready.", "success");
    }
  }, [clearLocationAndNearby, error, hasLocation, isRequesting, request]);

  return (
    <div className="pointer-events-none h-11 overflow-hidden rounded-full border border-outline-variant bg-surface/95">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isRequesting}
        aria-busy={isRequesting}
        aria-pressed={hasLocation}
        aria-label={distanceStatusLabel(status, hasLocation, error)}
        className={cn(
          "pointer-events-auto inline-flex h-full items-center gap-1.5 px-3 font-display text-[10px] font-bold tracking-widest uppercase transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-wait disabled:opacity-60",
          hasLocation
            ? "bg-primary text-on-primary"
            : status === "denied"
              ? "bg-primary text-on-primary hover:bg-primary/90"
              : "text-secondary hover:text-on-surface hover:bg-surface-container",
        )}
      >
        <LocationLed status={status} size={12} />
        <span>{distanceButtonLabel(status, hasLocation)}</span>
      </button>
    </div>
  );
}

export const CheckDistance = memo(CheckDistanceBase);
