import type { WeatherIconName } from "@/lib/types";

export interface WeatherVerificationSummary {
  active: boolean
  leader: WeatherIconName | null
  count: number
  expiresAt: string | null
  totalActive: number
}

export interface WeatherVerificationRepository {
  getActiveSummary(spotId: string): Promise<WeatherVerificationSummary>
  findLastVerificationAt(userId: string, spotId: string): Promise<Date | null>
  create(params: { spotId: string; userId: string; voteIcon: string; expiresAt: Date }): Promise<void>
  // For testing/cleanup - not exposed via API
  listActive(spotId: string): Promise<readonly { voteIcon: string; createdAt: Date; expiresAt: Date }[]>
}
