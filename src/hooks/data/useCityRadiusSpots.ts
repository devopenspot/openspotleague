"use client";

import { useEffect } from "react";
import { useSpotsStore } from "@/stores/spots-store";
import type { Spot } from "@/lib/types";
import { MAP_CITY_RADIUS_METERS } from "@/lib/config/constants";
import { walkNearbySpots } from "@/hooks/data/useNearbySpots";

/**
 * Client scope walk for the map's city filter: the rendered city scope
 * is the picked city's spots **plus** every public spot within
 * `MAP_CITY_RADIUS_METERS` (55 km) of the city spots' centroid
 * (border-crossing rows included — the scope is distance-based, like
 * Nearby mode). The client directory is capped at `SPOT_LIST_HARD_CAP`
 * and the city list (`citySpots`) only covers the picked city, so the
 * wider scope must be fetched: the same cursor-paged
 * `GET /api/spots?near=lat,lon,meters` read the Nearby walk uses, at
 * the city radius instead.
 *
 * Coordinates come from `deriveSpotCentroid(citySpots)` — deterministic
 * for a given city dataset — and are session-cached at 3 decimals
 * (~110 m), so re-picking the same city resolves from cache without a
 * fetch. Results mirror into the `cityRadiusSpots` store slice, read by
 * MapTab's city-scope union, `MapInfoPopup` pin resolution and
 * `useWeatherVerification` bumps (radius rows can sit outside the base
 * directory, `countrySpots` and `citySpots` alike).
 *
 * The slice is cleared whenever the scope exits or the centroid
 * changes, before any new walk starts: a stale city's rows must never
 * survive into another city's union while its walk is in flight.
 */

const sessionCache = new Map<string, readonly Spot[]>();

export function cacheKeyForCityRadius(lat: number, lon: number): string {
  return `city-radius|${lat.toFixed(3)}|${lon.toFixed(3)}`;
}

interface UseCityRadiusSpotsParams {
  /** City spots' centroid (3-decimal cache key); `null` when unknown. */
  lat: number | null;
  lon: number | null;
  /**
   * True only while the map's city filter is active in filtered mode
   * (no focus spot, no saved/nearby mode override).
   */
  enabled: boolean;
}

/**
 * No-op (and clears the slice) unless the city-radius scope is active
 * with a known centroid. On each new centroid it clears the slice, then
 * either mirrors the session cache or walks the scope pages and mirrors
 * the outcome.
 */
export function useCityRadiusSpots({
  lat,
  lon,
  enabled,
}: UseCityRadiusSpotsParams): void {
  useEffect(() => {
    const setCityRadiusSpots = useSpotsStore.getState().setCityRadiusSpots;
    // Clear-on-(re)entry: the slice must never carry a previous scope's
    // rows while a new key's walk is in flight (the cache-hit path
    // re-mirrors immediately after).
    setCityRadiusSpots([]);
    if (!enabled || lat === null || lon === null) return;
    const key = cacheKeyForCityRadius(lat, lon);
    const cached = sessionCache.get(key);
    if (cached) {
      setCityRadiusSpots(cached);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void walkNearbySpots(lat, lon, controller.signal, MAP_CITY_RADIUS_METERS).then(
      (outcome) => {
        if (cancelled) return;
        if (outcome.complete) sessionCache.set(key, outcome.spots);
        setCityRadiusSpots(outcome.spots);
      },
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, lat, lon]);
}
