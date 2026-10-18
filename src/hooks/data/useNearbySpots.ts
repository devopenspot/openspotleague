"use client";

import { useEffect } from "react";
import { useSpotsStore } from "@/stores/spots-store";
import type { Spot } from "@/lib/types";
import {
  MAP_NEARBY_MAX_RADIUS_METERS,
  SPOT_LIST_HARD_CAP,
} from "@/lib/config/constants";

/**
 * Client scope walk for the map's Nearby mode.
 *
 * The hydrated client directory is capped at `SPOT_LIST_HARD_CAP`
 * (500) name-ordered rows out of the full public catalog, so filtering
 * it by haversine radius finds zero spots for most users of the seeded
 * data. This hook fetches the complete within-radius set instead, the
 * same way the filtered mode overlays the capped directory with the
 * server-fetched full lists for its country/city scopes
 * (`countrySpots`/`citySpots` store overlays).
 *
 * Transport is the existing public `GET /api/spots?near=lat,lon,meters`
 * cursor-paged read (`repo.list({ near })` — `ST_DWithin` per page,
 * `(slug,id)` cursor replay). Pages are walked sequentially, at most
 * `NEARBY_SCOPE_MAX_PAGES` of `SPOT_LIST_HARD_CAP` rows each; a metro
 * within the maximum radius holds far fewer rows (Bogotá: 45), so the
 * cap is a transport bound, not an expected one. Reaching the page cap
 * counts as the complete documented scope (mirroring `map-country`'s
 * safety valve); only a failed or aborted request yields a non-cached
 * partial that still refreshes the slice.
 *
 * Caching uses a per-session map keyed by coordinates rounded to 3
 * decimals (~110 m — GPS fixes never repeat exactly). The same rounded
 * coordinates are sent on the wire so the cached key and the executed
 * query always coincide. Results mirror into the `nearbySpots` store
 * slice (Nearby mode is its only reader).
 */

export const NEARBY_SCOPE_MAX_PAGES = 4;

const sessionCache = new Map<string, readonly Spot[]>();

export function cacheKeyForNearby(lat: number, lon: number): string {
  return `${lat.toFixed(3)}|${lon.toFixed(3)}`;
}

export function buildNearbyUrl(
  lat: number,
  lon: number,
  cursor: string | null,
  radiusMeters: number = MAP_NEARBY_MAX_RADIUS_METERS,
): string {
  const params = new URLSearchParams({
    near: `${lat},${lon},${radiusMeters}`,
    limit: String(SPOT_LIST_HARD_CAP),
  });
  if (cursor) params.set("cursor", cursor);
  return `/api/spots?${params.toString()}`;
}

interface SpotListResponse {
  items?: Spot[];
  nextCursor?: string | null;
}

export interface WalkOutcome {
  spots: readonly Spot[];
  /**
   * True when the walk finished inside the documented bound (cursor
   * exhausted or page cap reached) — such results are cacheable.
   * False only for failed/aborted walks; their partials still refresh
   * the slice but a later visit re-walks instead of trusting them.
   */
  complete: boolean;
}

export async function walkNearbySpots(
  lat: number,
  lon: number,
  signal: AbortSignal,
  radiusMeters: number = MAP_NEARBY_MAX_RADIUS_METERS,
): Promise<WalkOutcome> {
  const collected: Spot[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < NEARBY_SCOPE_MAX_PAGES; page++) {
    let data: SpotListResponse;
    try {
      const res = await fetch(buildNearbyUrl(lat, lon, cursor, radiusMeters), { signal });
      if (!res.ok) return { spots: collected, complete: false };
      data = (await res.json()) as SpotListResponse;
    } catch {
      // Failed or aborted request. Abort never reaches the store (the
      // caller's `cancelled` flag is set in the same cleanup that
      // aborted), so the partial simply evaporates.
      return { spots: collected, complete: false };
    }
    const items = Array.isArray(data.items) ? data.items : [];
    for (const spot of items) {
      if (seen.has(spot.id)) continue;
      seen.add(spot.id);
      collected.push(spot);
    }
    cursor = data.nextCursor ?? null;
    if (!cursor) return { spots: collected, complete: true };
  }
  return { spots: collected, complete: true };
}

export interface UseNearbySpotsParams {
  lat: number | null;
  lon: number | null;
  /** True only while Nearby mode is active (Nearby + granted location). */
  enabled: boolean;
}

/**
 * No-op unless Nearby is active with a granted position. On each new
 * position (3-decimal key) it walks the scope pages and mirrors the
 * rows into the `nearbySpots` store slice; the session cache resolves
 * repeats without a fetch.
 */
export function useNearbySpots({
  lat,
  lon,
  enabled,
}: UseNearbySpotsParams): void {
  useEffect(() => {
    if (!enabled || lat === null || lon === null) return;
    const key = cacheKeyForNearby(lat, lon);
    const cached = sessionCache.get(key);
    if (cached) {
      useSpotsStore.getState().setNearbySpots(cached);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void walkNearbySpots(lat, lon, controller.signal).then((outcome) => {
      if (cancelled) return;
      if (outcome.complete) sessionCache.set(key, outcome.spots);
      useSpotsStore.getState().setNearbySpots(outcome.spots);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, lat, lon]);
}
