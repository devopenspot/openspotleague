import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/server"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import {
  countVerificationsForSpot,
  isVerified,
} from "@/lib/services/spot/verified-spots"
import {
  ALLOWED_WEATHER_VOTE_ICONS,
  getWeatherVerificationSummary,
  runCheckWeatherVerificationThrottle,
  verifySpotWithWeatherForUser,
} from "@/lib/services/spot/weather-verifications"
import { haversineMeters } from "@/lib/spots/geo"
import { log } from "@/lib/utils/log"

const GetQuery = z
  .object({
    spotId: z.string().min(1),
  })
  .strict()

const PostBody = z
  .object({
    spotId: z.string().min(1),
    latitude: z.number().finite(),
    longitude: z.number().finite(),
    accuracyMeters: z.number().finite().nullable().optional(),
    voteIcon: z.enum(ALLOWED_WEATHER_VOTE_ICONS as unknown as [string, ...string[]]),
  })
  .strict()

const MAX_ACCURACY_METERS = 50
const RADIUS_METERS = 250

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const parsed = GetQuery.safeParse({ spotId: url.searchParams.get("spotId") })
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { spotId } = parsed.data
  try {
    const user = await requireUser().catch(() => null)
    const [count, userVerified, weather] = await Promise.all([
      countVerificationsForSpot(spotId),
      user ? isVerified(user.id, spotId) : Promise.resolve(null),
      getWeatherVerificationSummary(spotId),
    ])
    return NextResponse.json(
      { spotId, count, isVerified: userVerified, weather },
      { headers: { "Cache-Control": "private, no-cache" } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    log.error("api.spot_verifications.get_failed", msg)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    log.warn("api.spot_verifications.post_unauthorized", msg)
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = PostBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { spotId, latitude, longitude, accuracyMeters, voteIcon } = parsed.data

  // Location verification
  if (accuracyMeters !== null && accuracyMeters !== undefined) {
    if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
      return NextResponse.json({ error: "Invalid accuracyMeters" }, { status: 400 })
    }
    if (accuracyMeters > MAX_ACCURACY_METERS) {
      return NextResponse.json(
        { error: "low_accuracy", reason: "low_accuracy", accuracyMeters, maxAccuracyMeters: MAX_ACCURACY_METERS },
        { status: 400 },
      )
    }
  }

  // Fetch spot location
  try {
    const spotRepo = await getSpotRepositoryAsync()
    const spot = await spotRepo.findById(spotId)
    if (!spot) {
      return NextResponse.json({ error: `Spot not found: ${spotId}` }, { status: 404 })
    }
    const distance = Math.round(
      haversineMeters(latitude, longitude, spot.location.lat, spot.location.lon),
    )
    if (distance > RADIUS_METERS) {
      return NextResponse.json(
        { error: "too_far", reason: "too_far", distanceMeters: distance, radiusMeters: RADIUS_METERS },
        { status: 400 },
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    log.error("api.spot_verifications.location_check_failed", msg)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  // Throttle check (also inside service, but early return with Retry-After)
  try {
    const throttle = await runCheckWeatherVerificationThrottle(user.id, spotId)
    if (!throttle.allowed) {
      const retryAfterSec = throttle.retryAfterMs ? Math.ceil(throttle.retryAfterMs / 1000) : 1800
      return NextResponse.json(
        { error: "Too many verifications — wait 30 minutes", reason: "throttled", retryAfterMs: throttle.retryAfterMs },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      )
    }
  } catch (err) {
    log.warn("api.spot_verifications.throttle_check_failed", (err as Error).message)
  }

  try {
    const result = await verifySpotWithWeatherForUser({
      userId: user.id,
      spotId,
      voteIcon,
    })
    return NextResponse.json({
      ok: true,
      count: result.verificationCount,
      isVerified: result.alreadyVerifiedSpot,
      weather: result.summary,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    if (msg.startsWith("Spot not found")) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (msg.includes("Too many verifications") || msg.includes("wait 30")) {
      return NextResponse.json({ error: msg, reason: "throttled" }, { status: 429 })
    }
    if (msg.startsWith("Invalid voteIcon")) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    log.error("api.spot_verifications.verify_failed", msg)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
