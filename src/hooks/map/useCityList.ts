"use client";

import { useEffect, useState } from "react";
import type { CityOption } from "@/hooks/map/useMapFilter";

/**
 * Server-truth city list for the searcher's city drill-down, served by
 * `GET /api/spots/cities` and merged over the client-derived options in
 * `RegionFilter`. Results are cached per country for the session so
 * re-drilling a country does not refetch.
 */

export interface ServedCity {
  slug: string;
  name: string;
  admin1?: string | null;
  spotCount?: number;
  lat?: number;
  lon?: number;
}

export interface CityListState {
  country: string;
  /** Server-ordered entries with optional admin1 state/province and spotCount. */
  cities: readonly ServedCity[];
  /** True once the request settled (success or error). */
  done: boolean;
}

function isServedCity(value: unknown): value is ServedCity {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.slug === "string" &&
    entry.slug.length > 0 &&
    typeof entry.name === "string" &&
    entry.name.length > 0
  );
}

/**
 * Merge the client-derived options with the server-truth list. Server order
 * is authoritative (the server ordered by true spot volume) — no re-sort.
 * Client display names are upgraded to server names; client-only slugs
 * (drifted/duplicated data) still fall back client-side.
 */
export function mergeCityOptions(
  base: readonly CityOption[],
  server: readonly ServedCity[],
): readonly CityOption[] {
  if (server.length === 0) return base;
  const baseBySlug = new Map(base.map((o) => [o.slug, o] as const));
  const merged: CityOption[] = [];
  for (const entry of server) {
    const baseEntry = baseBySlug.get(entry.slug);
    merged.push({
      slug: entry.slug,
      name: entry.name,
      count:
        typeof entry.spotCount === "number"
          ? entry.spotCount
          : (baseEntry?.count ?? 0),
      ...(entry.admin1 ? { admin1: entry.admin1 } : {}),
      ...(typeof entry.spotCount === "number"
        ? { spotCount: entry.spotCount }
        : {}),
      ...(typeof entry.lat === "number" && typeof entry.lon === "number"
        ? { lat: entry.lat, lon: entry.lon }
        : {}),
    });
    if (baseEntry) baseBySlug.delete(entry.slug);
  }
  for (const leftover of baseBySlug.values()) merged.push(leftover);
  return merged;
}

const sessionCache = new Map<string, readonly ServedCity[]>();

export function useCityList(
  country: string | null,
  enabled: boolean,
): CityListState | null {
  const [fresh, setFresh] = useState<CityListState | null>(null);

  useEffect(() => {
    if (!country || !enabled || sessionCache.has(country)) return;
    const controller = new AbortController();
    let cancelled = false;
    fetch(`/api/spots/cities?country=${encodeURIComponent(country)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data: { cities?: unknown } = await res.json();
        const cities = Array.isArray(data.cities)
          ? data.cities.filter(isServedCity)
          : [];
        sessionCache.set(country, cities);
        if (!cancelled) setFresh({ country, cities, done: true });
      })
      .catch(() => {
        // Settled-but-empty means "no server override": the caller falls
        // back to the client-derived list instead of blocking the step on
        // a failed request.
        if (!cancelled) setFresh({ country, cities: [], done: true });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [country, enabled]);

  if (!country) return null;
  // Session hits resolve synchronously; `fresh` only covers the one fetch
  // this hook instance performed (gated to its country).
  const cached = sessionCache.get(country);
  if (cached) return { country, cities: cached, done: true };
  return fresh && fresh.country === country ? fresh : null;
}
