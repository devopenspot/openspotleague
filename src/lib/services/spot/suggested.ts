import { cacheLife, cacheTag } from "next/cache"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"
import { NEARBY_RADIUS_CAP_METERS } from "@/lib/config/constants"
import type { Spot } from "@/lib/types"

/**
 * Server-truth pool for the spot detail page's "Suggested Spots"
 * section. The previous implementation filtered the hydrated client
 * directory (first `SPOT_LIST_HARD_CAP` = 500 alphabetical spots),
 * so suggestions missed most of the DB and went stale with the
 * directory cache. This pool is the public, non-hidden spots within
 * `NEARBY_RADIUS_CAP_METERS` of the current spot (PostGIS
 * `ST_DWithin` via `repo.findNearbyPublic`), fetched on the server.
 *
 * The client (`buildSuggestedSpots`) keeps ranking the pool by the
 * user's live location when granted — the pool only bounds what the
 * DB supplies.
 */
const SUGGESTED_POOL_LIMIT = 30

export interface SuggestedPoolParams {
  spotId: string
  lat: number
  lon: number
}

export async function runListSuggestedSpots(
  params: SuggestedPoolParams,
): Promise<readonly Spot[]> {
  if (
    !Number.isFinite(params.lat) ||
    !Number.isFinite(params.lon)
  ) {
    return []
  }
  const repo = await getSpotRepositoryAsync()
  // Nearest-N in SQL (current spot excluded server-side): ~30 rows on the
  // wire instead of a fixed 200-row page. The client filter/slice stays as
  // a guard for repositories that ignore `limit`/`excludeId`.
  const nearby = await repo.findNearbyPublic({
    lat: params.lat,
    lon: params.lon,
    radiusMeters: NEARBY_RADIUS_CAP_METERS,
    limit: SUGGESTED_POOL_LIMIT,
    excludeId: params.spotId,
  })
  return nearby
    .filter((s) => s.id !== params.spotId)
    .slice(0, SUGGESTED_POOL_LIMIT)
}

export async function listSuggestedSpots(
  params: SuggestedPoolParams,
): Promise<readonly Spot[]> {
  "use cache"
  // Same tag the standard list service carries: every spot mutation
  // already revalidates "spots:list" via `revalidateSpotCaches`. The
  // cache key is the spot id + coordinates, so moving a spot lands in
  // a fresh key on top of the tag invalidation.
  cacheTag("spots:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListSuggestedSpots(params)
}
