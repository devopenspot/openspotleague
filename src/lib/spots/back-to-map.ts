import { findRegionForCountry } from "@/lib/spots/suggestions";
import { ROUTES } from "@/lib/navigation/nav";
import { slugify } from "@/lib/utils/slug";
import type { Region, Spot } from "@/lib/types";

/**
 * "Explore around this spot" radius for the map focus deep link
 * (`/map?…&spot=<id>&around=<miles>`). The map shows every spot within
 * this distance of the focused spot, not just the spot's city.
 */
export const AROUND_PARAM = "around";
export const AROUND_RADIUS_OPTIONS = [10, 25, 50] as const;
export type AroundRadiusMiles = (typeof AROUND_RADIUS_OPTIONS)[number];
export const AROUND_DEFAULT_MILES: AroundRadiusMiles = 10;
export const AROUND_MAX_MILES: AroundRadiusMiles = 50;

/**
 * Read the `around` radius from map search params. Missing or tampered
 * values (and old focus links that predate the param) fall back to the
 * default, so every focus link explores around its spot.
 */
export function readAroundMiles(params: {
  get(key: string): string | null;
}): AroundRadiusMiles {
  const raw = Number(params.get(AROUND_PARAM));
  return (
    AROUND_RADIUS_OPTIONS.find((miles) => miles === raw) ??
    AROUND_DEFAULT_MILES
  );
}

/**
 * Build the "View on map" URL for a spot detail page.
 *
 * Contract (shared-link safe):
 * - Pure: depends only on `spot` + optional `regions` for the region slug.
 * - Always filters to the spot's country (deterministic slugify, no store race).
 * - Always narrows to the spot's city when `citySlug` is present (raw canonical
 *   `citySlug`, same value the map filter's `city` URL param validates against).
 * - Strips `nearby`/`saved` so country filtering is not shadowed by mode.
 * - Adds `around=<default miles>` so the map explores around the spot
 *   (spots near a city's edge keep their neighbours in the next town).
 * - `regions` is optional: when unavailable (cold shared link, degraded DB)
 *   we still emit `country` via direct slug, just omit `region`.
 */
export function buildBackToMapUrl(
  spot: Spot,
  regions?: readonly Region[],
): string {
  const next = new URLSearchParams();
  const countrySlug = slugify(spot.country);
  if (countrySlug) next.set("country", countrySlug);
  if (spot.citySlug) next.set("city", spot.citySlug);
  if (regions) {
    const region = findRegionForCountry(spot.country, regions);
    if (region) next.set("region", slugify(region.name));
  }
  next.set("spot", spot.id);
  next.set(AROUND_PARAM, String(AROUND_DEFAULT_MILES));
  const query = next.toString();
  return query ? `${ROUTES.map}?${query}` : ROUTES.map;
}

/**
 * @deprecated Use buildBackToMapUrl(spot, regions?) — URL is now derived purely
 * from the spot, not from current search params. Kept for backward compat
 * until callers migrate.
 */
export function buildBackToMapUrlFromParams(
  _current: { get(key: string): string | null },
  spot: Spot,
  regions?: readonly Region[],
): string {
  return buildBackToMapUrl(spot, regions);
}
