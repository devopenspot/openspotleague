import type { SavedSpotWithDetails } from "@/types/saved-spot"

export interface SavedSpotsListResult {
  items: readonly SavedSpotWithDetails[]
  nextCursor: string | null
}

export interface SavedSpotHeadsListResult {
  items: readonly { userId: string; spotId: string; createdAt: string }[]
  nextCursor: string | null
}

export interface SavedSpotsRepository {
  list(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<SavedSpotsListResult>
  listHeads(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<SavedSpotHeadsListResult>
  isSaved(userId: string, spotId: string): Promise<boolean>
  save(userId: string, spotId: string): Promise<void>
  unsave(userId: string, spotId: string): Promise<void>
  countForSpot(spotId: string): Promise<number>
}
