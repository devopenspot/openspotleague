import { cacheLife, cacheTag } from "next/cache"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"
import { SPOT_LIST_HARD_CAP } from "@/lib/config/constants"
import type { MapSpot } from "@/lib/types"

/**
 * The map searcher filters the hydrated client directory, which is
 * capped at `SPOT_LIST_HARD_CAP` (500) spots — one page of
 * `spotRepo.list()`. With 26k+ public spots that page holds only a
 * sliver of most countries (e.g. 1 of Colombia's 163), so counts and
 * pins disagree with the DB. This service pages the slim map-scope
 * repository query (cursor-based, `country` filter on `countries.name`,
 * optional `city` filter on `spots.city_slug`) until the requested
 * scope is fully loaded, so the map can show all of it without shipping
 * unused moderation/timestamp columns.
 */

// Safety valve: never loop unbounded if a cursor misbehaves.
// 20 pages × 500 = 10k spots — far above the largest country (US ~4.2k).
const MAP_COUNTRY_MAX_PAGES = 20

export async function runListSpotsForMapScope(
  country: string,
  citySlug?: string | null,
): Promise<readonly MapSpot[]> {
  const repo = await getSpotRepositoryAsync()
  const listPage = repo.listForMapScope ? repo.listForMapScope.bind(repo) : repo.list.bind(repo)
  const items: MapSpot[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAP_COUNTRY_MAX_PAGES; page++) {
    const result = await listPage({
      country,
      city: citySlug ?? undefined,
      limit: SPOT_LIST_HARD_CAP,
      cursor: cursor ?? undefined,
    })
    items.push(...result.items)
    if (!result.nextCursor) return items
    cursor = result.nextCursor
  }
  return items
}

export async function listSpotsForMapScope(
  country: string,
  citySlug?: string | null,
): Promise<readonly MapSpot[]> {
  "use cache"
  // Same tag the standard list service carries: every spot mutation
  // already revalidates "spots:list" via `revalidateSpotCaches`, which
  // keeps these per-scope pages fresh without extra tag plumbing.
  cacheTag("spots:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListSpotsForMapScope(country, citySlug)
}
