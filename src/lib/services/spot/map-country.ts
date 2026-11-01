import { cacheLife, cacheTag } from "next/cache";
import { getSpotRepositoryAsync } from "@/lib/repositories";
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes";
import { SPOT_LIST_HARD_CAP } from "@/lib/config/constants";
import { log } from "@/lib/utils/log";
import type { MapSpot } from "@/lib/types";
import type { MapSpotListResult } from "@/lib/repositories/core/types";

/**
 * The map searcher filters the hydrated client directory, which is
 * capped at `SPOT_LIST_HARD_CAP` (500) spots — one page of
 * `spotRepo.list()`. With 15k+ public spots that page holds only a
 * sliver of most countries (e.g. 1 of Colombia's 163), so counts and
 * pins disagree with the DB. This service pages the slim map-scope
 * repository query (cursor-based, `country` filter on `countries.name`,
 * optional `city` filter on `spots.city_slug`) until the requested
 * scope is fully loaded, so the map can show all of it without shipping
 * unused moderation/timestamp columns.
 */

// Safety valve: never loop unbounded if a cursor misbehaves.
// 20 pages × 500 = 10k spots — far above the largest country (US ~4.2k).
const MAP_COUNTRY_MAX_PAGES = 20;
// Maximum time budget (ms) for paginating sequential pages during server execution
const MAX_PAGINATION_DURATION_MS = 6000;
/**
 * Metro-area radius around a selected city's canonical coordinates so spots in
 * neighboring municipalities or across an international border (e.g. Basel/Weil
 * am Rhein, Detroit/Windsor) are included in the single server scope query.
 */
export const CITY_RADIUS_METERS = 28_000;

type CityRadius = { lat: number; lon: number; radiusMeters: number };

async function resolveCityRadius(
  country: string,
  citySlug: string,
): Promise<CityRadius | undefined> {
  const repo = await getSpotRepositoryAsync();
  if (!repo.findCityInCountry) return undefined;
  const cityRecord = await repo.findCityInCountry(country, citySlug);
  if (
    cityRecord &&
    typeof cityRecord.lat === "number" &&
    typeof cityRecord.lon === "number"
  ) {
    return {
      lat: cityRecord.lat,
      lon: cityRecord.lon,
      radiusMeters: CITY_RADIUS_METERS,
    };
  }
  return undefined;
}

export async function runListMapScopePage(
  country: string,
  citySlug: string | null,
  cityRadius: CityRadius | undefined,
  cursor: string | null,
): Promise<MapSpotListResult> {
  const repo = await getSpotRepositoryAsync();
  const listPage = repo.listForMapScope
    ? repo.listForMapScope.bind(repo)
    : repo.list.bind(repo);
  return listPage({
    country,
    city: citySlug ?? undefined,
    ...(cityRadius ? { cityRadius } : {}),
    limit: SPOT_LIST_HARD_CAP,
    cursor: cursor ?? undefined,
  });
}

/**
 * One cached page (<= SPOT_LIST_HARD_CAP rows, ~250 KB) of a map scope.
 *
 * `"use cache: remote"`: entries live in the Workers Response Store, shared
 * across isolates, so a miss does not re-read the whole country (up to 20
 * pages) from Postgres on every isolate. Caching per PAGE (not per country)
 * keeps each entry far below the 2 MB item limit; the US scope alone
 * serialises to well over 2 MB.
 */
async function listMapScopePage(
  country: string,
  citySlug: string | null,
  cityRadius: CityRadius | undefined,
  cursor: string | null,
): Promise<MapSpotListResult> {
  "use cache: remote";
  cacheTag("spots:list");
  cacheLife(LIST_CACHE_LIFE);
  return runListMapScopePage(country, citySlug, cityRadius, cursor);
}

async function findCityRadiusCached(
  country: string,
  citySlug: string,
): Promise<CityRadius | null> {
  "use cache: remote";
  cacheTag("spots:list");
  cacheLife(LIST_CACHE_LIFE);
  return (await resolveCityRadius(country, citySlug)) ?? null;
}

async function walkMapScope(
  country: string,
  citySlug: string | null,
  fetchRadius: (country: string, citySlug: string) => Promise<CityRadius | null | undefined>,
  fetchPage: typeof runListMapScopePage,
): Promise<readonly MapSpot[]> {
  const cityRadius = citySlug
    ? ((await fetchRadius(country, citySlug)) ?? undefined)
    : undefined;
  const items: MapSpot[] = [];
  let cursor: string | null = null;
  const startTime = Date.now();
  for (let page = 0; page < MAP_COUNTRY_MAX_PAGES; page++) {
    if (page > 0 && Date.now() - startTime > MAX_PAGINATION_DURATION_MS) {
      log.warn("runListSpotsForMapScope: pagination exceeded time budget, returning partial list", {
        country,
        citySlug,
        page,
        loadedSpots: items.length,
      });
      return items;
    }
    const result = await fetchPage(country, citySlug, cityRadius, cursor);
    items.push(...result.items);
    if (!result.nextCursor) return items;
    cursor = result.nextCursor;
  }
  return items;
}

/** Uncached walk (scripts/tests). */
export async function runListSpotsForMapScope(
  country: string,
  citySlug?: string | null,
): Promise<readonly MapSpot[]> {
  return walkMapScope(country, citySlug ?? null, resolveCityRadius, runListMapScopePage);
}

/**
 * Full public map scope for a country (optionally a city + metro radius).
 * The walk itself is not cached — each page is (see `listMapScopePage`),
 * so the per-entry size stays bounded and pages are shared by every
 * instance. Every spot mutation already revalidates "spots:list" via
 * `revalidateSpotCaches`.
 */
export async function listSpotsForMapScope(
  country: string,
  citySlug?: string | null,
): Promise<readonly MapSpot[]> {
  return walkMapScope(country, citySlug ?? null, findCityRadiusCached, listMapScopePage);
}
