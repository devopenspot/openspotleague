import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { listSpots } from "@/lib/services/spot/spots"
import { getSpotWeather } from "@/lib/weather/weather-cached"
import { log } from "@/lib/utils/log"

import {
  MAX_CONCURRENT_WEATHER,
  MAX_SPOT_IDS_PER_REQUEST,
} from "@/lib/config/constants"

const QuerySchema = z.object({
	spotIds: z
		.string()
		.min(1)
		.transform((raw) =>
			raw
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
		)
		.pipe(
			z
				.array(z.string().min(1))
				.min(1)
				.max(MAX_SPOT_IDS_PER_REQUEST, `spotIds capped at ${MAX_SPOT_IDS_PER_REQUEST}`),
		),
})

/**
 * Public read-only endpoint. Returns the per-spot weather for a list
 * of spot IDs, looked up by lat/lon via the cached spots list and
 * fetched per spot through the cached `getSpotWeather` boundary.
 *
 * The previous design ran a bulk `getWeatherForAllSpots` from the
 * root layout's SSR path. With ~200 seeded spots, that fan-out hit
 * OpenWeather's 60 req/min ceiling through the in-process token
 * bucket, making a cold-cache first render take several minutes
 * even though it eventually succeeded. This route replaces the
 * SSR fan-out with an on-demand client fetch — only the spots the
 * page actually displays (6 spotlight cards on the home page, ~20
 * visible markers on the map, 1 on the spot detail) are ever
 * requested, and the per-spot `"use cache"` boundary means the
 * second visit is free.
 */
export async function GET(request: NextRequest) {
	const url = new URL(request.url)
	const parsed = QuerySchema.safeParse({
		spotIds: url.searchParams.get("spotIds") ?? "",
	})
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid query", details: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	const { spotIds } = parsed.data
	// Dedup so a caller that passes overlapping ids doesn't double-fire
	// the same per-spot cache key.
	const uniqueIds = Array.from(new Set(spotIds))

	try {
		// `listSpots({ ids })` is itself cached ("use cache" / spots:list
		// tag / 60s revalidate) so the coordinate lookup is O(1) on warm
		// cache. The route does not need its own cache layer.
		const spotList = await listSpots({ ids: uniqueIds })
		const spotsById = new Map(spotList.items.map((s) => [s.id, s]))
		const entries: Array<readonly [string, Awaited<ReturnType<typeof getSpotWeather>>]> = []

		let cursor = 0
		async function worker(): Promise<void> {
			while (true) {
				const i = cursor++
				if (i >= uniqueIds.length) return
				const id = uniqueIds[i]
				if (!id) return
				const spot = spotsById.get(id)
				if (!spot) return
				const w = await getSpotWeather({
					spotId: spot.id,
					latitude: spot.location.lat,
					longitude: spot.location.lon,
				})
				entries.push([spot.id, w])
			}
		}
		const workerCount = Math.min(MAX_CONCURRENT_WEATHER, uniqueIds.length)
		await Promise.all(
			Array.from({ length: workerCount }, () => worker()),
		)

		const res = NextResponse.json({ weather: Object.fromEntries(entries) })
		// Public per-spot weather — inner getSpotWeather is "use cache" (6h);
		// short CDN TTL absorbs home-spotlight + map-marker fan-out.
		res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300")
		return res
	} catch (err) {
		log.error(
			"api.weather.list_failed",
			err instanceof Error ? err.message : err,
		)
		return NextResponse.json({ error: "Internal error" }, { status: 500 })
	}
}
