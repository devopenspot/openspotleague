"use client";

import { useEffect, useState } from "react";
import { walkNearbySpots } from "@/hooks/data/useNearbySpots";
import { milesToMeters } from "@/lib/spots/geo";
import { AROUND_MAX_MILES } from "@/lib/spots/back-to-map";
import type { Spot } from "@/lib/types";

/**
 * Spots around a focused spot for the map's "View on map" deep link
 * (`/map?…&spot=<id>&around=<miles>`).
 *
 * The focus link used to show only the spot's city, so a spot near a city
 * edge (SOPO, tagged Bogotá, ~26 km from its centre) lost its neighbours
 * in the next town. This walks every public spot within the LARGEST
 * `around` radius of the spot once, through the same cursor-paged
 * `GET /api/spots?near=` read as Nearby mode (`walkNearbySpots`); the
 * radius chips then filter client-side without refetching.
 *
 * State is local (not the `nearbySpots` store slice), so Nearby mode,
 * which is anchored on the rider, stays independent. Complete walks are
 * cached per session by rounded coordinates (~110 m) + radius.
 */

const AREA_RADIUS_METERS = milesToMeters(AROUND_MAX_MILES);

const sessionCache = new Map<string, readonly Spot[]>();

export function cacheKeyForSpotArea(
  lat: number,
  lon: number,
  radiusMeters: number = AREA_RADIUS_METERS,
): string {
  return `${lat.toFixed(3)}|${lon.toFixed(3)}|${Math.round(radiusMeters)}`;
}

/** Test hook: drop the per-session cache. */
export function clearSpotAreaCache(): void {
  sessionCache.clear();
}

export interface UseSpotAreaSpotsParams {
  lat: number | null;
  lon: number | null;
  enabled: boolean;
}

export interface SpotAreaState {
  spots: readonly Spot[];
  loading: boolean;
}

const EMPTY: readonly Spot[] = [];

export function useSpotAreaSpots({
  lat,
  lon,
  enabled,
}: UseSpotAreaSpotsParams): SpotAreaState {
  const active = enabled && lat !== null && lon !== null;
  const key = active ? cacheKeyForSpotArea(lat, lon) : null;
  const [result, setResult] = useState<{
    key: string;
    spots: readonly Spot[];
  } | null>(null);

  useEffect(() => {
    if (key === null || lat === null || lon === null) return;
    if (sessionCache.has(key)) return;

    const controller = new AbortController();
    let cancelled = false;

    void walkNearbySpots(
      Number(lat.toFixed(3)),
      Number(lon.toFixed(3)),
      controller.signal,
      AREA_RADIUS_METERS,
    ).then((outcome) => {
      if (cancelled) return;
      if (outcome.complete) sessionCache.set(key, outcome.spots);
      setResult({ key, spots: outcome.spots });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, lat, lon]);

  if (key === null) return { spots: EMPTY, loading: false };
  const cached = sessionCache.get(key);
  if (cached) return { spots: cached, loading: false };
  if (result?.key === key) return { spots: result.spots, loading: false };
  return { spots: EMPTY, loading: true };
}
