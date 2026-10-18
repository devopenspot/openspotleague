import { cacheLife, cacheTag, revalidateTag } from "next/cache"
import { getDbClient } from "@/lib/db/client"
import { getSpotRepositoryAsync, getWeatherVerificationRepositoryAsync } from "@/lib/repositories"
import { REPORT_CACHE_LIFE, LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"
import { spots, verifiedSpots, spotWeatherVerifications } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import type { WeatherVerificationSummary } from "@/lib/repositories/spot/weather-verification-repository"

export const WEATHER_VERIFICATION_TTL_MS = 2 * 60 * 60 * 1000
export const WEATHER_VERIFICATION_THROTTLE_MS = 30 * 60 * 1000

export const ALLOWED_WEATHER_VOTE_ICONS = ["sunny", "partly_cloudy_day", "cloudy", "rain", "snow"] as const
export type AllowedWeatherVoteIcon = (typeof ALLOWED_WEATHER_VOTE_ICONS)[number]

function weatherTag(spotId: string): string {
  return `weather-verified:spot:${spotId}`
}

function spotVerifiedTag(spotId: string): string {
  return `verified-spots:spot:${spotId}`
}

function userVerifiedTag(userId: string): string {
  return `verified-spots:user:${userId}`
}

// ---------- cached summary ----------
export async function runGetWeatherVerificationSummary(spotId: string): Promise<WeatherVerificationSummary> {
  const repo = await getWeatherVerificationRepositoryAsync()
  return repo.getActiveSummary(spotId)
}

export async function getWeatherVerificationSummary(spotId: string): Promise<WeatherVerificationSummary> {
  "use cache"
  cacheTag(weatherTag(spotId))
  cacheLife(REPORT_CACHE_LIFE)
  return runGetWeatherVerificationSummary(spotId)
}

// ---------- throttle check ----------
export async function runCheckWeatherVerificationThrottle(
  userId: string,
  spotId: string,
): Promise<{ allowed: boolean; retryAfterMs: number | null }> {
  const repo = await getWeatherVerificationRepositoryAsync()
  const last = await repo.findLastVerificationAt(userId, spotId)
  if (!last) return { allowed: true, retryAfterMs: null }
  const elapsed = Date.now() - new Date(last as unknown as string).getTime()
  if (elapsed >= WEATHER_VERIFICATION_THROTTLE_MS) return { allowed: true, retryAfterMs: null }
  return { allowed: false, retryAfterMs: WEATHER_VERIFICATION_THROTTLE_MS - elapsed }
}

// ---------- atomic co-verification ----------
export async function verifySpotWithWeatherForUser(params: {
  userId: string
  spotId: string
  voteIcon: string
}): Promise<{ verificationCount: number; summary: WeatherVerificationSummary; alreadyVerifiedSpot: boolean }> {
  const { userId, spotId, voteIcon } = params
  if (!ALLOWED_WEATHER_VOTE_ICONS.includes(voteIcon as AllowedWeatherVoteIcon)) {
    throw new Error(`Invalid voteIcon: ${voteIcon}`)
  }

  const spotRepo = await getSpotRepositoryAsync()
  const spot = await spotRepo.findById(spotId)
  if (!spot) throw new Error(`Spot not found: ${spotId}`)

  // Throttle check
  const throttle = await runCheckWeatherVerificationThrottle(userId, spotId)
  if (!throttle.allowed) {
    const err = new Error(`Too many verifications — wait 30 minutes`) as Error & { retryAfterMs?: number }
    ;(err as unknown as { retryAfterMs: number }).retryAfterMs = throttle.retryAfterMs ?? WEATHER_VERIFICATION_THROTTLE_MS
    throw err
  }

  const { db } = getDbClient()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + WEATHER_VERIFICATION_TTL_MS)

  // Transaction: insert verified_spots (idempotent) + weather verification
  let verificationCount = 0

  await db.transaction(async (tx) => {
    await tx.insert(verifiedSpots).values({ userId, spotId }).onConflictDoNothing()

    await tx
      .insert(spotWeatherVerifications)
      .values({
        spotId,
        userId,
        voteIcon: voteIcon as never,
        expiresAt,
      })

    const [row] = await tx.select({ x: spots.verificationCount }).from(spots).where(eq(spots.id, spotId)).limit(1)
    verificationCount = row?.x ?? 0
  })

  const verifyRepo = await getWeatherVerificationRepositoryAsync()
  const summary = await verifyRepo.getActiveSummary(spotId)
  const [vRow] = await db
    .select({ userId: verifiedSpots.userId })
    .from(verifiedSpots)
    .where(and(eq(verifiedSpots.userId, userId), eq(verifiedSpots.spotId, spotId)))
    .limit(1)
  const alreadyVerifiedSpot = Boolean(vRow)

  revalidateTag(weatherTag(spotId), REPORT_CACHE_LIFE)
  revalidateTag(spotVerifiedTag(spotId), LIST_CACHE_LIFE)
  revalidateTag(userVerifiedTag(userId), LIST_CACHE_LIFE)

  return { verificationCount, summary, alreadyVerifiedSpot }
}
