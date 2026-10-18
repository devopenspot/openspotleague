import { haversineMiles, type LatLon } from "@/lib/spots/geo";
import type { Region, Spot } from "@/lib/types";

export const SUGGESTED_SPOTS_LIMIT = 8;
export const SUGGESTED_SPOTS_MIN = 3;

export interface SuggestedSpotsParams {
  current: Spot;
  all: readonly Spot[];
  origin: LatLon | null;
  limit?: number;
}

export interface SuggestedSpotsResult {
  spots: readonly Spot[];
  scopeLabel: string;
}

export function findRegionForCountry(
  country: string,
  regions: readonly Region[],
): Region | undefined {
  if (!country) return undefined;
  return regions.find((r) => r.countries.includes(country));
}

function hasFiniteLocation(s: Spot): boolean {
  return Number.isFinite(s.location.lat) && Number.isFinite(s.location.lon);
}

function rankByDistance(pool: readonly Spot[], origin: LatLon): Spot[] {
  return [...pool]
    .map((s) => ({
      s,
      d: haversineMiles(origin.lat, origin.lon, s.location.lat, s.location.lon),
    }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.s);
}

export function buildSuggestedSpots(
  params: SuggestedSpotsParams,
): SuggestedSpotsResult {
  const { current, all, origin } = params;
  const limit = params.limit ?? SUGGESTED_SPOTS_LIMIT;

  const fallbackOrigin =
    origin ?? (hasFiniteLocation(current) ? current.location : null);
  if (!fallbackOrigin) return { spots: [], scopeLabel: "" };

  const pool = all.filter((s) => s.id !== current.id && hasFiniteLocation(s));
  const ordered = rankByDistance(pool, fallbackOrigin);

  return {
    spots: ordered.slice(0, limit),
    scopeLabel: origin
      ? "Nearest spots to you"
      : `Nearest spots to ${current.name}`,
  };
}
