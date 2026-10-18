import type { Spot } from "@/lib/types"

export interface SavedSpot {
  userId: string
  spotId: string
  createdAt: string
}

export interface SavedSpotWithDetails extends SavedSpot {
  spot: Spot
}

export interface VerifiedSpotLink {
  userId: string
  spotId: string
  createdAt: string
}

export interface VerifiedSpotWithDetails extends VerifiedSpotLink {
  spot: Spot
}
