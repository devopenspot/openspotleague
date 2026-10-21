import type { MapSpot, Region } from "@/lib/types";
import { haversineMiles } from "@/lib/spots/geo";
import { slugify } from "@/lib/utils/slug";
import type { MapLayer } from "@/lib/schemas/event";
import type { MapEvent } from "@/types/sport-events";

export interface MapOrigin {
  lat: number;
  lon: number;
}

export interface MapSpotView {
  spots: readonly MapSpot[];
  distanceMilesById: ReadonlyMap<string, number>;
}

/**
 * Union of two spot lists by id — base order preserved first, extra
 * entries appended in their own order. Used by MapTab to widen the
 * capped client directory with the server-fetched full list of the
 * currently filtered country (`countrySpots` page prop) without
 * duplicates or resorting.
 */
export function unionById<T extends MapSpot = MapSpot>(
  base: readonly T[],
  extra: readonly T[],
): readonly T[] {
  if (extra.length === 0) return base;
  const byId = new Map<string, T>();
  for (const spot of base) byId.set(spot.id, spot);
  for (const spot of extra) byId.set(spot.id, spot);
  return [...byId.values()];
}

/**
 * Resolves the city-scoped spot slice: prefers explicit `citySpots`
 * (used when the server-side `countrySpots` walk degraded to empty
 * under DB deadlines) and otherwise derives `citySpots ⊂ countrySpots`
 * client-side so the server does not serialize duplicate city rows on
 * the wire when `countrySpots` succeeded.
 */
export function deriveScopeCitySpots<T extends MapSpot = MapSpot>(
  countrySpots: readonly T[],
  citySpots: readonly T[],
  citySlug: string | null | undefined,
): readonly T[] {
  if (citySpots.length > 0) return citySpots;
  if (!citySlug) return [];
  const normalized = citySlug.toLowerCase();
  return countrySpots.filter((spot) => spot.citySlug === normalized);
}

/**
 * Arithmetic-mean lat/lon of a spot list — the "center point" of a
 * city's spots used by the map's city-radius scope
 * (`useCityRadiusSpots`). `null` for an empty list: with no spots there
 * is no center and no radius scope (e.g. a tampered city slug renders
 * an empty view rather than a scope around nothing).
 */
export function deriveSpotCentroid(
  spots: readonly MapSpot[],
): MapOrigin | null {
  if (spots.length === 0) return null;
  let lat = 0;
  let lon = 0;
  for (const spot of spots) {
    lat += spot.location.lat;
    lon += spot.location.lon;
  }
  return { lat: lat / spots.length, lon: lon / spots.length };
}

/**
 * Display name for the picked-city scope (`city` URL param, the canonical
 * `citySlug`) resolved against the spot list — mirrors `deriveCityOptions`
 * ("display name, taken from the first spot seen for the slug"). Both the
 * country and the slug must match a spot: city slugs are not globally
 * unique. `null` when unresolved so callers never leak the raw slug.
 */
export function deriveSpotCityDisplayName(
  spots: readonly MapSpot[],
  country: string | null,
  citySlug: string | null,
): string | null {
  if (!country || !citySlug) return null;
  return (
    spots.find(
      (spot) => spot.country === country && spot.citySlug === citySlug,
    )?.city ?? null
  );
}

/**
 * Bottom-left map scope pill text, filtered mode only (callers hide it
 * in nearby/saved/focus modes). `"City, Country"` when both resolve,
 * country alone for the `scope=country` no-city escape, `null` without
 * a resolved country — the pill has nothing to show outside a scope.
 */
export function deriveMapScopeLabel(
  cityDisplayName: string | null,
  country: string | null,
): string | null {
  if (!country) return null;
  return cityDisplayName ? `${cityDisplayName}, ${country}` : country;
}

/**
 * Apply the same location semantics as `useMapFilter` uses for spots. Map
 * events carry the country display name, which is also the canonical value in
 * the region catalog exposed to the client. Events may carry a canonical
 * `citySlug`; otherwise the display `city` is slugified on the fly.
 */
export function filterMapEventsByGeo(
  events: readonly MapEvent[],
  regions: readonly Pick<Region, "name" | "countries">[],
  region: string | null,
  country: string | null,
  citySlug: string | null = null,
): readonly MapEvent[] {
  if (!region && !country && !citySlug) return events;

  const regionCountries = region
    ? regions.find((entry) => entry.name === region)?.countries
    : null;

  return events.filter((event) => {
    if (region && !regionCountries?.includes(event.country)) return false;
    if (country && event.country !== country) return false;
    if (citySlug && (event.citySlug ?? slugify(event.city)) !== citySlug) {
      return false;
    }
    return true;
  });
}

export function deriveMapSpotView(
  spots: readonly MapSpot[],
  origin: MapOrigin | null,
  radiusMiles?: number,
): MapSpotView {
  if (origin === null) {
    return { spots, distanceMilesById: new Map() };
  }

  const distanceMilesById = new Map<string, number>();
  const visible = spots
    .map((spot) => {
      const distance = haversineMiles(
        origin.lat,
        origin.lon,
        spot.location.lat,
        spot.location.lon,
      );
      distanceMilesById.set(spot.id, distance);
      return { spot, distance };
    })
    .filter(({ distance }) => radiusMiles === undefined || distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);

  return {
    spots: visible.map(({ spot }) => spot),
    distanceMilesById,
  };
}

export type MapViewportPoint = [number, number];

export function deriveMapViewportPoints(
  spots: readonly MapSpot[],
  events: readonly MapEvent[],
  enabledLayers: ReadonlySet<MapLayer>,
): readonly MapViewportPoint[] {
  const points: MapViewportPoint[] = [];

  if (enabledLayers.has("spots")) {
    points.push(
      ...spots.map((spot) => [spot.location.lat, spot.location.lon] as MapViewportPoint),
    );
  }
  if (enabledLayers.has("events")) {
    points.push(
      ...events.map((event) => [event.lat, event.lon] as MapViewportPoint),
    );
  }

  return points;
}

export interface SpotGroup {
  key: string;
  city: string;
  countryCode: string;
  spots: readonly MapSpot[];
  closestMiles: number | null;
}

export type RenderedMapItem =
  | { kind: "spot"; spot: MapSpot; key: string }
  | {
      kind: "cluster";
      key: string;
      position: [number, number];
      label: string;
      count: number;
      spots: readonly MapSpot[];
    };

export function groupSpotsByCity(
  spots: readonly MapSpot[],
  origin: MapOrigin | null,
  distanceMilesById?: ReadonlyMap<string, number>,
): readonly SpotGroup[] {
  const buckets = new Map<string, MapSpot[]>();
  for (const spot of spots) {
    const countryCode = spot.countryCode || "—";
    const key = `${spot.city}|${countryCode}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.push(spot);
    } else {
      buckets.set(key, [spot]);
    }
  }

  const groups: SpotGroup[] = [];
  for (const [key, groupSpots] of buckets) {
    const firstSpot = groupSpots[0];
    if (!firstSpot) continue;
    const alphabetical = origin === null
      ? [...groupSpots].sort((a, b) => a.name.localeCompare(b.name))
      : groupSpots;
    const first = alphabetical[0];
    const closestMiles = origin && first
      ? distanceMilesById?.get(first.id) ??
        haversineMiles(origin.lat, origin.lon, first.location.lat, first.location.lon)
      : null;
    groups.push({
      key,
      city: firstSpot.city,
      countryCode: firstSpot.countryCode || "—",
      spots: alphabetical,
      closestMiles,
    });
  }

  if (origin === null) {
    return groups.sort(
      (a, b) => b.spots.length - a.spots.length || a.city.localeCompare(b.city),
    );
  }
  return groups.sort(
    (a, b) =>
      (a.closestMiles ?? Number.POSITIVE_INFINITY) -
      (b.closestMiles ?? Number.POSITIVE_INFINITY),
  );
}

export function buildRenderedMapItems(
  spots: readonly MapSpot[],
  zoom: number,
  clusterZoomMax: number,
): readonly RenderedMapItem[] {
  if (zoom <= clusterZoomMax && spots.length > 1) {
    const groups = new Map<string, MapSpot[]>();
    const cellSize = clusterCellSize(zoom);
    for (const spot of spots) {
      const cellKey = getClusterCellKey(spot, cellSize);
      const group = groups.get(cellKey);
      if (group) group.push(spot);
      else groups.set(cellKey, [spot]);
    }

    const items: RenderedMapItem[] = [];
    for (const [cellKey, group] of groups) {
      if (group.length < 2) {
        for (const spot of group) {
          items.push({ kind: "spot", spot, key: `spot:${spot.id}` });
        }
        continue;
      }
      const position = getClusterPosition(group);
      items.push({
        kind: "cluster",
        key: `cluster:${cellKey}`,
        position,
        label: group[0]?.types[0]?.name ?? "spots",
        count: group.length,
        spots: group,
      });
    }
    return items;
  }

  // At high zoom, check for overlapping co-located spots and micro-displace
  // so adjacent pins do not steal/hijack pointer events from each other.
  const coordBuckets = new Map<string, MapSpot[]>();
  for (const s of spots) {
    const key = `${s.location.lat.toFixed(4)}:${s.location.lon.toFixed(4)}`;
    const group = coordBuckets.get(key);
    if (group) group.push(s);
    else coordBuckets.set(key, [s]);
  }

  const items: RenderedMapItem[] = [];
  for (const [, group] of coordBuckets) {
    if (group.length === 1) {
      const s = group[0]!;
      items.push({ kind: "spot", spot: s, key: `spot:${s.id}` });
    } else {
      const count = group.length;
      const radius = 0.00015; // ~15m
      group.forEach((s, idx) => {
        const angle = (2 * Math.PI * idx) / count;
        const displacedSpot: MapSpot = {
          ...s,
          location: {
            lat: s.location.lat + radius * Math.cos(angle),
            lon: s.location.lon + radius * Math.sin(angle),
          },
        };
        items.push({ kind: "spot", spot: displacedSpot, key: `spot:${s.id}` });
      });
    }
  }

  return items;
}

function clusterCellSize(zoom: number): number {
  return Math.max(0.25, 12 / 2 ** Math.max(0, zoom - 2));
}

function getClusterCellKey(spot: MapSpot, cellSize: number): string {
  const latCell = Math.floor(spot.location.lat / cellSize);
  const lonCell = Math.floor(spot.location.lon / cellSize);
  return `${latCell}:${lonCell}`;
}

function getClusterPosition(spots: readonly MapSpot[]): [number, number] {
  let lat = 0;
  let lon = 0;
  for (const spot of spots) {
    lat += spot.location.lat;
    lon += spot.location.lon;
  }
  return [lat / spots.length, lon / spots.length];
}
