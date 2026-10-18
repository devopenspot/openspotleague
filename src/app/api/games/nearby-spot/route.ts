import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  gameErrorResponse,
  identityErrorResponse,
  resolveIdentity,
} from "@/app/api/games/identity"
import { enforceRateLimit } from "@/app/api/games/rate-limit"
import { findNearbyChallengeSpot } from "@/lib/services/games"
import { disciplineSlugSchema } from "@/lib/schemas/game"
import { haversineMeters } from "@/lib/spots/geo"

const Query = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lon: z.coerce.number().finite().min(-180).max(180),
  disciplineSlug: disciplineSlugSchema,
}).strict()

export async function GET(request: NextRequest) {
  let identity
  try {
    identity = await resolveIdentity(request, { allowAnonymous: true })
  } catch (error) {
    return identityErrorResponse(error)
  }

  try {
    enforceRateLimit(request, identity)
  } catch (error) {
    return gameErrorResponse(error)
  }

  const url = new URL(request.url)
  const parsed = Query.safeParse({
    lat: url.searchParams.get("lat") ?? undefined,
    lon: url.searchParams.get("lon") ?? undefined,
    disciplineSlug: url.searchParams.get("disciplineSlug") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const spot = await findNearbyChallengeSpot({
      latitude: parsed.data.lat,
      longitude: parsed.data.lon,
      disciplineSlug: parsed.data.disciplineSlug,
    })
    const res = NextResponse.json({
      spot,
      distanceMeters: spot
        ? Math.round(
            haversineMeters(
              parsed.data.lat,
              parsed.data.lon,
              spot.location.lat,
              spot.location.lon,
            ),
          )
        : null,
    })
    // Public spot payload, cached per exact query — rate limiter still applies.
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
    return res
  } catch (error) {
    return gameErrorResponse(error)
  }
}
