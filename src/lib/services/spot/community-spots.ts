import { cacheLife, cacheTag, revalidatePath, revalidateTag } from "next/cache"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import type { NewSpot, SpotListResult, SpotQuery } from "@/lib/repositories/core/types"
import type { Spot } from "@/lib/types"
import { COMMUNITY_RADIUS_METERS } from "@/lib/config/constants"
import { IMAGE_CACHE_LIFE, LIST_CACHE_LIFE, ITEM_CACHE_LIFE, WEATHER_CACHE_LIFE } from "@/lib/cache/lifetimes"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

export function buildSubmissionHash(lat: number, lon: number, name: string): string {
  return `${lat.toFixed(3)}:${lon.toFixed(3)}:${slugify(name)}`
}

function stripAnonymous(spot: Spot, requesterId: string | null): Spot {
  if (requesterId && spot.createdBy === requesterId) return spot
  // Curator check is service-layer; for v1 we strip for non-owners.
  // Admin/curator reads go via findByIdForUser which bypasses strip.
  return { ...spot, createdBy: null }
}

function revalidateCommunityCaches(spotId: string, slug: string | null): void {
  revalidateTag("spots:list", LIST_CACHE_LIFE)
  revalidateTag("spots:home", LIST_CACHE_LIFE)
  revalidateTag(`spots:item:${spotId}`, ITEM_CACHE_LIFE)
  if (slug) {
    revalidateTag(`spots:slug:${slug}`, ITEM_CACHE_LIFE)
    revalidatePath(`/spots/${slug}`)
  }
  revalidateTag("spots:nearby", LIST_CACHE_LIFE)
  revalidateTag("directory:common", LIST_CACHE_LIFE)
  revalidateTag("spot-images", IMAGE_CACHE_LIFE)
  revalidateTag("weather", WEATHER_CACHE_LIFE)
  revalidateTag(`weather:spot:${spotId}`, WEATHER_CACHE_LIFE)
  revalidatePath(`/spots/${spotId}`)
  revalidatePath("/saved")
  revalidatePath("/")
  revalidatePath("/map")
  revalidatePath("/explore")
}

export async function createPersonalSpot(input: NewSpot): Promise<Spot> {
  if (!input.createdBy) throw new Error("createPersonalSpot requires createdBy")
  const hash = buildSubmissionHash(input.location.lat, input.location.lon, input.name)
  const repo = await getSpotRepositoryAsync()
  const spot = await repo.createPersonal(input, { submissionHash: hash })
  revalidateCommunityCaches(spot.id, spot.slug)
  return spot
}

export async function listCreatedSpots(userId: string, query?: SpotQuery): Promise<SpotListResult> {
  const repo = await getSpotRepositoryAsync()
  return repo.listCreated(userId, query)
}

export async function findNearbyPublicSpots(params: { lat: number; lon: number; radiusMeters?: number }): Promise<readonly Spot[]> {
  const repo = await getSpotRepositoryAsync()
  return repo.findNearbyPublic({ lat: params.lat, lon: params.lon, radiusMeters: params.radiusMeters ?? COMMUNITY_RADIUS_METERS })
}

export async function findSpotByIdForUser(id: string, userId: string | null): Promise<Spot | null> {
  const repo = await getSpotRepositoryAsync()
  const spot = await repo.findByIdForUser(id, userId)
  if (!spot) return null
  // Keep createdBy for owner; strip otherwise
  if (userId && spot.createdBy === userId) return spot
  return stripAnonymous(spot, userId)
}

export async function runFindNearbyPublic(params: { lat: number; lon: number; radiusMeters: number }): Promise<readonly Spot[]> {
  const repo = await getSpotRepositoryAsync()
  return repo.findNearbyPublic(params)
}

export async function findNearbyPublicCached(params: { lat: number; lon: number; radiusMeters: number }): Promise<readonly Spot[]> {
  "use cache"
  cacheTag("spots:nearby")
  cacheLife(LIST_CACHE_LIFE)
  return runFindNearbyPublic(params)
}
