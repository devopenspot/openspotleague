import { cacheLife, cacheTag, revalidateTag } from "next/cache"
import {
  getSavedSpotsRepositoryAsync,
  getSpotRepositoryAsync,
} from "@/lib/repositories"
import type {
  SavedSpotHeadsListResult,
  SavedSpotsListResult,
} from "@/lib/repositories/spot/saved-spots-repository"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

function userTag(userId: string): string {
  return `saved-spots:user:${userId}`
}

// ---------- list ----------
// Per-user cached. Mutations call `revalidateTag(userTag(userId))`
// so the next list call re-fetches from the DB.

export async function runListSavedSpotHeads(
  userId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<SavedSpotHeadsListResult> {
  const repo = await getSavedSpotsRepositoryAsync()
  return repo.listHeads(userId, opts)
}

export async function listSavedSpotHeadsForUser(
  userId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<SavedSpotHeadsListResult> {
  "use cache"
  cacheTag(userTag(userId))
  cacheLife(LIST_CACHE_LIFE)
  return runListSavedSpotHeads(userId, opts)
}

export async function runListSavedSpots(
  userId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<SavedSpotsListResult> {
  const repo = await getSavedSpotsRepositoryAsync()
  return repo.list(userId, opts)
}

export async function listSavedSpotsForUser(
  userId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<SavedSpotsListResult> {
  "use cache"
  cacheTag(userTag(userId))
  cacheLife(LIST_CACHE_LIFE)
  return runListSavedSpots(userId, opts)
}

// ---------- isSaved ----------
// Live (uncached): the heart-icon toggle in the UI must reflect
// the latest state on every call. Caching this would let a stale
// "not saved" answer hide a save the user just made.

export async function runIsSaved(
  userId: string,
  spotId: string,
): Promise<boolean> {
  const repo = await getSavedSpotsRepositoryAsync()
  return repo.isSaved(userId, spotId)
}

// ---------- save ----------

export async function runSaveSpotForUser(
  userId: string,
  spotId: string,
): Promise<void> {
  const spotRepo = await getSpotRepositoryAsync()
  const spot = await spotRepo.findById(spotId)
  if (!spot) throw new Error(`Spot not found: ${spotId}`)
  const repo = await getSavedSpotsRepositoryAsync()
  await repo.save(userId, spotId)
}

export async function saveSpotForUser(
  userId: string,
  spotId: string,
): Promise<void> {
  await runSaveSpotForUser(userId, spotId)
  // `revalidateTag` takes a profile as its second arg (Next.js 16).
  // We pass `LIST_CACHE_LIFE` so the next read uses the same lifetime
  // the original `"use cache"` block was configured with.
  revalidateTag(userTag(userId), LIST_CACHE_LIFE)
}

// ---------- unsave ----------

export async function runUnsaveSpotForUser(
  userId: string,
  spotId: string,
): Promise<void> {
  const repo = await getSavedSpotsRepositoryAsync()
  await repo.unsave(userId, spotId)
}

export async function unsaveSpotForUser(
  userId: string,
  spotId: string,
): Promise<void> {
  await runUnsaveSpotForUser(userId, spotId)
  revalidateTag(userTag(userId), LIST_CACHE_LIFE)
}

