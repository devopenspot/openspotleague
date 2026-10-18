import { cache } from "react"
import { getSpotWeather } from "./weather-cached"
import type { SpotWeather } from "./weather-cached"
import { withDbConcurrency } from "@/lib/db/concurrency"
import type { Spot } from "@/lib/types"

// Concurrency cap for the per-spot fan-out. On a cold cache the loop
// would otherwise fire N parallel upstream calls (one per spot), which
// on a 500-spot render can trip OpenWeather's 60/min limit before
// the per-spot `"use cache"` can absorb subsequent calls. With the
// single-endpoint setup (one upstream call per spot) 6 in-flight
// spots is still well under the per-minute ceiling and shortens the
// cold-cache waterfall to ~500/6 ≈ 83 spots per second of bucket
// headroom. The token bucket in `./rate-limit` is the hard upper
// bound; this is a fast-path throttle.
const MAX_CONCURRENT_SPOTS = 6

/**
 * Per-spot weather is cached at the `getSpotWeather` boundary
 * (`"use cache"`, 6h revalidate, `weather` and `weather:spot:{spotId}`
 * tags). This helper is a thin composition that fans the spot list
 * out to the per-spot cache, with a small concurrency cap on the
 * cold-cache path so a 500-spot first render cannot trip
 * OpenWeather's 60 calls/min ceiling.
 *
 * Wrapped in React `cache()` so a single render that calls this
 * helper twice (e.g. the root and map layouts) shares one fan-out.
 */
export const getWeatherForAllSpots = cache(
	async (spots: readonly Spot[]): Promise<Record<string, SpotWeather>> => {
		if (spots.length === 0) return {}
		const entries = await withDbConcurrency(
			MAX_CONCURRENT_SPOTS,
			spots.map((s) => () =>
				getSpotWeather({
					spotId: s.id,
					latitude: s.location.lat,
					longitude: s.location.lon,
				}).then((weather) => [s.id, weather] as const),
			),
		)
		return Object.fromEntries(entries)
	},
)
