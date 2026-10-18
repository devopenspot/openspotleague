import { cacheLife, cacheTag, revalidateTag } from "next/cache"
import {
  getSpotRepositoryAsync,
  getVerifiedSpotsRepositoryAsync,
} from "@/lib/repositories"
import type {
  VerifiedSpotsListResult,
  VerifiedSpotsWithDetailsListResult,
} from "@/lib/repositories/spot/verified-spots-repository"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

function userTag(userId: string): string {
  return `verified-spots:user:${userId}`
}

function spotTag(spotId: string): string {
  return `verified-spots:spot:${spotId}`
}

// ---------- list ----------
// Per-user cached. Mutations call `revalidateTag(userTag(userId))`
// so the next list call re-fetches from the DB. Powers the layout
// fan-out (root + map) that pre-renders the user's verify state on
// the server — cards / popups / detail panels render with the
// correct `aria-pressed` from the first paint, no hydration flicker.

export async function runListVerifiedSpotsForUser(
  userId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<VerifiedSpotsListResult> {
  const repo = await getVerifiedSpotsRepositoryAsync()
  return repo.list(userId, opts)
}

export async function listVerifiedSpotsForUser(
  userId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<VerifiedSpotsListResult> {
  "use cache"
  cacheTag(userTag(userId))
  cacheLife(LIST_CACHE_LIFE)
  return runListVerifiedSpotsForUser(userId, opts)
}

// Uncached (live): powers the Saved tab's verified grid via
// `/api/verified-spots`. The per-user cached `list` above is read at
// SSR time for the verify-state paint; this variant joins full spot
// entities and must reflect fresh toggles, so avoid caching it.
export async function listVerifiedSpotsWithDetailsForUser(
  userId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<VerifiedSpotsWithDetailsListResult> {
  const repo = await getVerifiedSpotsRepositoryAsync()
  return repo.listWithSpots(userId, opts)
}

// ---------- isVerified ----------
// Live (uncached): the verify-toggle in the UI must reflect the
// latest state on every call. Caching this would let a stale
// "not verified" answer hide a verify the user just made — same
// trade-off as `runIsSaved` in `services/saved-spots.ts`.

export async function runIsVerified(
  userId: string,
  spotId: string,
): Promise<boolean> {
  const repo = await getVerifiedSpotsRepositoryAsync()
  return repo.isVerified(userId, spotId)
}

export async function isVerified(
  userId: string,
  spotId: string,
): Promise<boolean> {
  return runIsVerified(userId, spotId)
}

// ---------- countForSpot ----------
// Reads the denormalized `spots.verification_count` (kept in sync by
// the `bump_verification_count` trigger). Cached per spot with the
// standard list lifetime; mutations on `verified_spots` call
// `revalidateTag(spotTag(spotId))` so the count is fresh on the next
// render.

export async function runCountVerificationsForSpot(
  spotId: string,
): Promise<number> {
  const repo = await getVerifiedSpotsRepositoryAsync()
  return repo.countForSpot(spotId)
}

export async function countVerificationsForSpot(
  spotId: string,
): Promise<number> {
  "use cache"
  cacheTag(spotTag(spotId))
  cacheLife(LIST_CACHE_LIFE)
  return runCountVerificationsForSpot(spotId)
}

// ---------- verify / unverify ----------
// `revalidateTag` takes a profile as its second arg (Next.js 16). The
// per-user tag invalidates any per-user cached list (currently
// anticipatory — no "use cache" block reads it, but kept for
// symmetry with `saved-spots:user:<id>` and so a future
// "spots I verified" page works without further changes). The
// per-spot tag invalidates the denormalized count cache.
//
// Both mutators return the new `verification_count` after the trigger
// fires, so the API can echo it back to the client. The client uses
// it to update the optimistic count display without a second
// round-trip (like-feature UX).

export async function runVerifySpotForUser(
  userId: string,
  spotId: string,
): Promise<number> {
  // Sanity-check the spot exists — the FK would catch this too, but
  // a 404 from the API is friendlier than a constraint violation.
  const spotRepo = await getSpotRepositoryAsync()
  const spot = await spotRepo.findById(spotId)
  if (!spot) throw new Error(`Spot not found: ${spotId}`)
  const repo = await getVerifiedSpotsRepositoryAsync()
  return repo.verify(userId, spotId)
}

export async function verifySpotForUser(
  userId: string,
  spotId: string,
): Promise<number> {
  const count = await runVerifySpotForUser(userId, spotId)
  revalidateTag(userTag(userId), LIST_CACHE_LIFE)
  revalidateTag(spotTag(spotId), LIST_CACHE_LIFE)
  return count
}

export async function runUnverifySpotForUser(
  userId: string,
  spotId: string,
): Promise<number> {
  const repo = await getVerifiedSpotsRepositoryAsync()
  return repo.unverify(userId, spotId)
}

export async function unverifySpotForUser(
  userId: string,
  spotId: string,
): Promise<number> {
  const count = await runUnverifySpotForUser(userId, spotId)
  revalidateTag(userTag(userId), LIST_CACHE_LIFE)
  revalidateTag(spotTag(spotId), LIST_CACHE_LIFE)
  return count
}
