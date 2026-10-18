"use client";

import { useEffect, useRef } from "react";
import type { MapSpot } from "@/lib/types";
import {
  DEFAULT_NEARBY_RADIUS_MI,
  type NearbyRadiusMiles,
  type UserLocationStatus,
} from "@/stores/user-location-store";
import { milesToMeters } from "@/lib/spots/geo";
import type { RequestedMapMode } from "@/components/map/shared/map-mode";

interface MapLocation {
  lat: number;
  lon: number;
}

interface UseMapModeEffectsOptions {
  mode: RequestedMapMode;
  isAuthenticated: boolean;
  status: UserLocationStatus;
  location: MapLocation | null;
  radiusMiles: NearbyRadiusMiles;
  sourceSpots: readonly MapSpot[];
  /**
   * Full public spot list for the URL's country, mirrored from the map
   * page's RSC fetch into the spots store. The client spot directory is
   * capped (SPOT_LIST_HARD_CAP), so a country-scoped fit against it alone
   * would recentre on a partial extent. When this list is for a different
   * (stale) country, the dataset backing the selection has not arrived yet
   * and the refit is deferred until it does.
   */
  countrySpots?: readonly MapSpot[];
  /**
   * Full public spot list for the URL's city, fetched in parallel with
   * `countrySpots`. Its arrival is sufficient evidence that the dataset
   * backing a city selection is complete: the country walk can degrade
   * to empty under the DB deadlines, and deferring the fit on it alone
   * could leave a city selection unfitted forever.
   */
  citySpots?: readonly MapSpot[];
  activePinId: string | null;
  hasRegionFilter: boolean;
  region: string | null;
  country: string | null;
  city?: string | null;
  layerKey: string;
  setRadiusMiles: (miles: NearbyRadiusMiles) => void;
  setActivePin: (id: string | null) => void;
  dismissSaved: () => void;
  fitRadius: (radiusMeters: number) => void;
  fitBoundsToVisibleItems: () => void;
  hasFocus?: boolean;
}

export function useMapModeEffects({
  mode,
  isAuthenticated,
  status,
  location,
  radiusMiles,
  sourceSpots,
  countrySpots = [],
  citySpots = [],
  activePinId,
  hasRegionFilter,
  region,
  country,
  city = null,
  layerKey,
  setRadiusMiles,
  setActivePin,
  dismissSaved,
  fitRadius,
  fitBoundsToVisibleItems,
  hasFocus = false,
}: UseMapModeEffectsOptions): void {
  const previousModeRef = useRef<RequestedMapMode | null>(null);
  const previousLayerKeyRef = useRef<string | null>(null);

  const isNearby = mode === "nearby";
  const isSaved = mode === "saved";
  const hasLocation = status === "granted" && location !== null;

  useEffect(() => {
    if (hasFocus) return;
    if (activePinId && !sourceSpots.some((spot) => spot.id === activePinId)) {
      setActivePin(null);
    }
  }, [activePinId, hasFocus, setActivePin, sourceSpots]);

  useEffect(() => {
    if (isSaved && !isAuthenticated) dismissSaved();
  }, [dismissSaved, isAuthenticated, isSaved]);

  useEffect(() => {
    if (hasFocus) return;
    const previousMode = previousModeRef.current;
    previousModeRef.current = mode;
    if (isNearby) {
      if (previousMode !== "nearby") setRadiusMiles(DEFAULT_NEARBY_RADIUS_MI);
      return;
    }
    if (previousMode === mode) return;

    // Nearby has its own radius fit. All other mode transitions fit the
    // currently visible layer targets through the viewport controller.
    fitBoundsToVisibleItems();
  }, [fitBoundsToVisibleItems, hasFocus, isNearby, mode, setRadiusMiles]);

  useEffect(() => {
    if (!isNearby || !hasLocation || !location) return;
    fitRadius(milesToMeters(radiusMiles));
  }, [fitRadius, hasLocation, isNearby, location, radiusMiles]);

  useEffect(() => {
    if (hasFocus) return;
    const previousLayerKey = previousLayerKeyRef.current;
    previousLayerKeyRef.current = layerKey;
    if (previousLayerKey === null || previousLayerKey === layerKey) return;

    if (isNearby && hasLocation) {
      fitRadius(milesToMeters(radiusMiles));
    } else {
      fitBoundsToVisibleItems();
    }
  }, [
    fitBoundsToVisibleItems,
    fitRadius,
    hasFocus,
    hasLocation,
    isNearby,
    layerKey,
    radiusMiles,
  ]);

  // Region/country/city commits recenter the viewport on the narrowed spot
  // set — but only once the dataset backing the selection is complete. The
  // full public lists for the selected scope arrive asynchronously (the
  // `countrySpots`/`citySpots` RSC refetch), so a fit fired at commit time
  // would run on the capped global directory or a stale scope's list. Fit
  // on a value signature (selection + dataset size) instead of array
  // identity: the signature changes when the selection changes or when
  // the full list lands/grows, and stays stable across same-size
  // re-deliveries. While the data is not ready the signature is never
  // recorded, deferring the fit to exactly the render where the complete
  // set exists. For a city selection the city list alone counts as ready —
  // the country walk can degrade to empty under the DB deadlines and
  // must not block a city that has already delivered its pins. The
  // focus/nearby suffixes keep focus-exit and nearby-exit refits working
  // (parity with the previous dep-based behavior) without fitting while
  // those modes are live.
  const fittedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSaved && !hasRegionFilter) {
      fittedSignatureRef.current = null;
      return;
    }
    const countryDataReady =
      countrySpots.length === 0 ||
      countrySpots.every((spot) => spot.country === country) ||
      (city !== null && citySpots.length > 0);
    if (!countryDataReady) return;
    const signature = `${region ?? ""}|${country ?? ""}|${city ?? ""}|${sourceSpots.length}${hasFocus ? "|focus" : ""}${isNearby ? "|nearby" : ""}`;
    if (fittedSignatureRef.current === signature) return;
    fittedSignatureRef.current = signature;
    if (hasFocus || isNearby) return;
    fitBoundsToVisibleItems();
  }, [
    city,
    citySpots,
    country,
    countrySpots,
    fitBoundsToVisibleItems,
    hasFocus,
    hasRegionFilter,
    isNearby,
    isSaved,
    region,
    sourceSpots,
  ]);
}
