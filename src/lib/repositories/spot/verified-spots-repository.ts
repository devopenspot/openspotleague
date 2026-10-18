import type { VerifiedSpotWithDetails } from "@/types/saved-spot"

export interface VerifiedSpotsRepository {
  isVerified(userId: string, spotId: string): Promise<boolean>
  /**
   * Inserts the (user, spot) row idempotently and returns the new
   * denormalized `spots.verification_count` after the trigger fires.
   * Returning the count from the same call lets the API echo it
   * back to the client so the like-style count can update without
   * a second round-trip.
   */
  verify(userId: string, spotId: string): Promise<number>
  /**
   * Deletes the (user, spot) row and returns the new
   * `spots.verification_count` after the trigger fires.
   */
  unverify(userId: string, spotId: string): Promise<number>
  /**
   * Reads the denormalized `spots.verification_count`. The DB trigger
   * keeps this in sync with `verified_spots` so the call is a single
   * indexed lookup (no per-row `count(*)`).
   */
  countForSpot(spotId: string): Promise<number>
  /**
   * Per-user list. Mirrors `saved_spots.list` — used by the layout
   * fan-out to pre-render the user's verify state on the server
   * (no hydration flicker on the first paint).
   */
  list(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<VerifiedSpotsListResult>
  /**
   * Per-user list joined with full spot entities (mirrors
   * `DrizzleSavedSpotsRepository.list`). Powers the Saved tab's
   * verified grid without cross-referencing the capped client
   * directory — spots outside that directory still render.
   */
  listWithSpots(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<VerifiedSpotsWithDetailsListResult>
}

export interface VerifiedSpotsListResult {
  items: readonly { userId: string; spotId: string; createdAt: string }[]
  nextCursor: string | null
}

export interface VerifiedSpotsWithDetailsListResult {
  items: readonly VerifiedSpotWithDetails[]
  nextCursor: string | null
}
