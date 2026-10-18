import { cacheLife, cacheTag, revalidatePath, revalidateTag } from "next/cache"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import { log } from "@/lib/utils/log"
import type {
  NewSpot,
  SpotCard,
  SpotCardListResult,
  SpotListResult,
  SpotPatch,
  SpotQuery,
  SpotShuffleFilters,
} from "@/lib/repositories/core/types"
import type { Spot } from "@/lib/types"
import { NEARBY_RADIUS_CAP_METERS, SPOT_LIST_HARD_CAP } from "@/lib/config/constants"
import { decodeRandomSpotCursor, encodeRandomSpotCursor } from "@/lib/repositories/spot/spot-pagination"
import { seededShuffle } from "@/lib/utils/seeded-random"
import {
  IMAGE_CACHE_LIFE,
  ITEM_CACHE_LIFE,
  LIST_CACHE_LIFE,
  WEATHER_CACHE_LIFE,
} from "@/lib/cache/lifetimes"

// ---------- list ----------

export async function runListSpots(
  query?: SpotQuery,
): Promise<SpotListResult> {
  const repo = await getSpotRepositoryAsync()
  return repo.list(query)
}

export async function listSpots(query?: SpotQuery): Promise<SpotListResult> {
  "use cache"
  cacheTag("spots:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListSpots(query)
}

export async function runGetSpotsTotalCount(): Promise<number> {
  const repo = await getSpotRepositoryAsync()
  return repo.count()
}

/**
 * Server-truth total (public, non-hidden). Replaces client counters
 * derived from the capped hydrated directory (`spots.length <= 500`).
 */
export async function getSpotsTotalCount(): Promise<number> {
  "use cache"
  cacheTag("spots:list")
  cacheLife(LIST_CACHE_LIFE)
  return runGetSpotsTotalCount()
}

// ---------- shuffle cards (landing wire) ----------
//
// Seeded shuffle pagination without the O(table) cost: the filtered ID
// list is cached by filter (shared across visitors — the per-visitor
// seed never enters the cache key), the shuffle/slice happens in
// memory, and only slim card columns are fetched for the page. Shares
// the `spots:list` tag, so every spot mutation invalidates it via the
// existing `revalidateSpotCaches`.

export function toSpotShuffleFilters(query: SpotQuery): SpotShuffleFilters {
  const { cursor, seed, random, limit, near, ...filters } = query
  void cursor
  void seed
  void random
  void limit
  void near
  return filters
}

export async function listSpotShuffleIds(
  filters: SpotShuffleFilters,
): Promise<readonly string[]> {
  "use cache"
  cacheTag("spots:list")
  cacheLife(LIST_CACHE_LIFE)
  const repo = await getSpotRepositoryAsync()
  return repo.listShuffledIds(filters)
}

export function toSpotCard(spot: Spot): SpotCard {
  return {
    id: spot.id,
    name: spot.name,
    city: spot.city,
    image: spot.image,
    sports: spot.sports,
  }
}

export async function runListSpotCards(query: SpotQuery): Promise<SpotCardListResult> {
  // Geo + random stays deterministic (the fall-through the repository
  // had), as does a seed-less call — project to cards either way.
  if (query.near || !query.seed) {
    const fallback = await runListSpots({ ...query, random: false, seed: undefined })
    return { items: fallback.items.map(toSpotCard), nextCursor: fallback.nextCursor }
  }
  const limit = Math.min(query.limit ?? SPOT_LIST_HARD_CAP, SPOT_LIST_HARD_CAP)
  const ids = await listSpotShuffleIds(toSpotShuffleFilters(query))
  if (ids.length === 0) return { items: [], nextCursor: null }
  const cursor = decodeRandomSpotCursor(query.cursor)
  const startIndex = cursor && cursor.seed === query.seed ? cursor.index : 0
  const pageIds = seededShuffle(ids, query.seed).slice(startIndex, startIndex + limit)
  if (pageIds.length === 0) return { items: [], nextCursor: null }
  const repo = await getSpotRepositoryAsync()
  const cards = await repo.listCardsByIds(pageIds)
  const byId = new Map(cards.map((card) => [card.id, card]))
  const ordered = pageIds
    .map((id) => byId.get(id))
    .filter((card): card is SpotCard => card !== undefined)
  // Detail (800) is the smallest variant that stays crisp in the
  // 232px × 32vh wire cards — same rationale as the old wire path.
  const { getSpotDetailImageUrlsCached } = await import("@/lib/storage")
  const { extractStoragePath } = await import("@/lib/storage/variants")
  const urlMap = await getSpotDetailImageUrlsCached(
    ordered.map((card) => extractStoragePath(card.image)).filter((p): p is string => p !== null),
  )
  const items = ordered.map((card) => {
    const path = extractStoragePath(card.image)
    if (path && urlMap.has(path)) return { ...card, image: urlMap.get(path)! }
    return card
  })
  const nextIndex = startIndex + pageIds.length
  return {
    items,
    nextCursor:
      nextIndex < ids.length ? encodeRandomSpotCursor({ seed: query.seed, index: nextIndex }) : null,
  }
}

export async function listSpotCards(query: SpotQuery): Promise<SpotCardListResult> {
  "use cache"
  cacheTag("spots:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListSpotCards(query)
}

// ---------- findById ----------

export async function runFindSpotById(id: string): Promise<Spot | null> {
  const repo = await getSpotRepositoryAsync()
  return repo.findById(id)
}

export async function findSpotById(id: string): Promise<Spot | null> {
  "use cache"
  cacheTag(`spots:item:${id}`)
  cacheLife(ITEM_CACHE_LIFE)
  return runFindSpotById(id)
}

// ---------- findBySlug ----------

export async function runFindSpotBySlug(slug: string): Promise<Spot | null> {
  const repo = await getSpotRepositoryAsync()
  return repo.findBySlug(slug)
}

export async function findSpotMediaState(id: string) {
  const repo = await getSpotRepositoryAsync()
  return repo.findMediaState(id)
}

export async function findSpotBySlug(slug: string): Promise<Spot | null> {
  "use cache"
  cacheTag(`spots:slug:${slug}`)
  cacheLife(ITEM_CACHE_LIFE)
  return runFindSpotBySlug(slug)
}

// ---------- findNearby ----------

export async function runFindNearbySpots(params: {
  lat: number
  lon: number
  radiusMeters: number
}): Promise<readonly Spot[]> {
  const repo = await getSpotRepositoryAsync()
  return repo.findNearby(params)
}

export async function findNearbySpots(params: {
  lat: number
  lon: number
  radiusMeters: number
}): Promise<readonly Spot[]> {
  "use cache"
  cacheTag("spots:nearby")
  cacheLife(LIST_CACHE_LIFE)
  return runFindNearbySpots({
    lat: params.lat,
    lon: params.lon,
    radiusMeters: Math.min(params.radiusMeters, NEARBY_RADIUS_CAP_METERS),
  })
}

// ---------- mutators ----------
// `revalidateTag` is called with the same cache-life profile the
// original `"use cache"` block was configured with (Next.js 16
// requires the profile arg).

// Shared invalidation for every spot mutation. Tags must match the ones
// declared by the `"use cache"` read services; profiles come from
// `@/lib/cache/lifetimes` (Next 16 requires the exact object reference).
function revalidateSpotCaches(spotId: string, slug: string | null): void {
  revalidateTag("spots:list", LIST_CACHE_LIFE)
  revalidateTag("spots:home", LIST_CACHE_LIFE)
  // Region counts live in the regions catalog (`regions:all`) and are
  // attached to it by `runListRegions`; without this a create/hide/
  // delete would leave the searcher's per-country counts stale.
  revalidateTag("regions:all", LIST_CACHE_LIFE)
  revalidateTag(`spots:item:${spotId}`, ITEM_CACHE_LIFE)
  if (slug) {
    revalidateTag(`spots:slug:${slug}`, ITEM_CACHE_LIFE)
    revalidatePath(`/spots/${slug}`)
  }
  revalidateTag("spots:nearby", LIST_CACHE_LIFE)
  revalidateTag("directory:common", LIST_CACHE_LIFE)
  revalidateTag("spot-images", IMAGE_CACHE_LIFE)
  // Invalidate the per-spot weather cache: if the spot's coordinates
  // changed, the old location's weather would otherwise serve for
  // up to 6h. The `weather` group tag is also revalidated for the
  // home/map fan-out caches.
  revalidateTag("weather", WEATHER_CACHE_LIFE)
  revalidateTag(`weather:spot:${spotId}`, WEATHER_CACHE_LIFE)
  revalidatePath(`/spots/${spotId}`)
  revalidatePath("/admin/spots")
  revalidatePath(`/admin/spots/${spotId}`)
  revalidatePath("/")
  revalidatePath("/map")
  revalidatePath("/explore")
}

export async function runCreateSpot(input: NewSpot): Promise<Spot> {
  const repo = await getSpotRepositoryAsync()
  return repo.create(input)
}

export async function createSpot(input: NewSpot): Promise<Spot> {
  const spot = await runCreateSpot(input)
  revalidateSpotCaches(spot.id, spot.slug)
  return spot
}

export async function runUpdateSpot(
  id: string,
  patch: SpotPatch,
  expectedUpdatedAt?: string,
  actorId?: string | null,
): Promise<Spot> {
  const repo = await getSpotRepositoryAsync()
  return repo.update(id, patch, expectedUpdatedAt, actorId)
}

export async function updateSpot(
  id: string,
  patch: SpotPatch,
  expectedUpdatedAt?: string,
  actorId?: string | null,
): Promise<Spot> {
  const spot = await runUpdateSpot(id, patch, expectedUpdatedAt, actorId)
  revalidateSpotCaches(id, spot.slug)
  return spot
}

export async function runDeleteSpot(
  id: string,
  expectedUpdatedAt?: string,
  actorId?: string | null,
) {
  const repo = await getSpotRepositoryAsync()
  return repo.delete(id, expectedUpdatedAt, actorId)
}

export async function deleteSpot(
  id: string,
  expectedUpdatedAt?: string,
  actorId?: string | null,
) {
  // Best-effort fetch slug for cache invalidation before delete/hide
  let slug: string | null = null
  try {
    const existing = await runFindSpotById(id)
    slug = existing?.slug ?? null
  } catch (_err) {
    void _err
  }
  const result = await runDeleteSpot(id, expectedUpdatedAt, actorId)
  log.info("spots.delete", { id, detach: result.detachSummary ?? null })
  revalidateSpotCaches(id, slug)
  return result
}

export async function runHideSpot(id: string, expectedUpdatedAt?: string, actorId?: string | null) {
  const repo = await getSpotRepositoryAsync()
  return repo.hideSpot(id, expectedUpdatedAt, actorId)
}

export async function hideSpot(id: string, expectedUpdatedAt?: string, actorId?: string | null) {
  let slug: string | null = null
  try {
    const existing = await runFindSpotById(id)
    slug = existing?.slug ?? null
  } catch (_err) {
    void _err
  }
  const result = await runHideSpot(id, expectedUpdatedAt, actorId)
  revalidateSpotCaches(id, slug)
  return result
}

export async function runHideSpotCluster(id: string, expectedUpdatedAt?: string, actorId?: string | null) {
  const repo = await getSpotRepositoryAsync()
  return repo.hideCluster(id, expectedUpdatedAt, actorId)
}

export async function hideSpotCluster(id: string, expectedUpdatedAt?: string, actorId?: string | null) {
  let slug: string | null = null
  try {
    const existing = await runFindSpotById(id)
    slug = existing?.slug ?? null
  } catch (_err) {
    void _err
  }
  const result = await runHideSpotCluster(id, expectedUpdatedAt, actorId)
  revalidateSpotCaches(id, slug)
  // Cluster may have many ids — invalidate list/nearby broadly (already done via tags)
  return result
}

export async function runUnhideSpot(id: string, expectedUpdatedAt?: string, actorId?: string | null) {
  const repo = await getSpotRepositoryAsync()
  return repo.unhideSpot(id, expectedUpdatedAt, actorId)
}

export async function unhideSpot(id: string, expectedUpdatedAt?: string, actorId?: string | null) {
  let slug: string | null = null
  try {
    const existing = await runFindSpotById(id)
    slug = existing?.slug ?? null
  } catch (_err) {
    void _err
  }
  const result = await runUnhideSpot(id, expectedUpdatedAt, actorId)
  revalidateSpotCaches(id, slug)
  return result
}
