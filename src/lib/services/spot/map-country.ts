import { cacheLife, cacheTag } from "next/cache";
import { getSpotRepositoryAsync } from "@/lib/repositories";
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes";
import { SPOT_LIST_HARD_CAP } from "@/lib/config/constants";
import { log } from "@/lib/utils/log";
import type { MapSpot } from "@/lib/types";

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

export async function runListSpotsForMapScope(
  country: string,
  citySlug?: string | null,
): Promise<readonly MapSpot[]> {
  const repo = await getSpotRepositoryAsync();
  const listPage = repo.listForMapScope
    ? repo.listForMapScope.bind(repo)
    : repo.list.bind(repo);
  let cityRadius:
    | { lat: number; lon: number; radiusMeters: number }
    | undefined;
  if (citySlug && repo.findCityInCountry) {
    const cityRecord = await repo.findCityInCountry(country, citySlug);
    if (
      cityRecord &&
      typeof cityRecord.lat === "number" &&
      typeof cityRecord.lon === "number"
    ) {
      cityRadius = {
        lat: cityRecord.lat,
        lon: cityRecord.lon,
        radiusMeters: CITY_RADIUS_METERS,
      };
    }
  }
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
    const result = await listPage({
      country,
      city: citySlug ?? undefined,
      ...(cityRadius ? { cityRadius } : {}),
      limit: SPOT_LIST_HARD_CAP,
      cursor: cursor ?? undefined,
    });
    items.push(...result.items);
    if (!result.nextCursor) return items;
    cursor = result.nextCursor;
  }
  return items;
}

export async function listSpotsForMapScope(
  country: string,
  citySlug?: string | null,
): Promise<readonly MapSpot[]> {
  "use cache";
  // Same tag the standard list service carries: every spot mutation
  // already revalidates "spots:list" via `revalidateSpotCaches`, which
  // keeps these per-scope pages fresh without extra tag plumbing.
  cacheTag("spots:list");
  cacheLife(LIST_CACHE_LIFE);
  return runListSpotsForMapScope(country, citySlug);
}
