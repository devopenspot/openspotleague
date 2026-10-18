import { log } from "@/lib/utils/log"
import type {
	SavedSpotHeadsListResult,
	SavedSpotsListResult,
} from "@/lib/repositories/spot/saved-spots-repository"
import type { SpotListResult } from "@/lib/repositories/core/types"
import type { VerifiedSpotsListResult } from "@/lib/repositories/spot/verified-spots-repository"
import type { SpotWeather } from "@/lib/weather/weather-cached"

// Server-component data providers (`RootDataProviders`,
// `MapDataProviders`, the spot detail `generateMetadata`, the sitemap)
// call into the cached service layer at render time. When the upstream
// DB is unreachable — bad env, paused project, network partition — the
// service call throws, the layout's `Promise.all` rejects, and the
// whole page 500s.
//
// `withSafeDefault` is the standard wrapper for these read paths. It
// returns a caller-supplied fallback on any thrown error, logs a
// `log.warn` so the degradation is observable, and lets the page render
// with empty data instead of crashing. This is what makes the AGENTS.md
// "anonymous browsing works even when Supabase env is missing" promise
// actually true for the DB-dependent pages.

export async function withSafeDefault<T>(
	fn: () => Promise<T>,
	fallback: T,
	label: string,
): Promise<T> {
	try {
		return await fn()
	} catch (error) {
		log.warn(`safe-fetch[${label}] failed:`, error)
		return fallback
	}
}

export interface SafeDefaultResult<T> {
	value: T
	degraded: boolean
}

export async function withSafeDefaultResult<T>(
	fn: () => Promise<T>,
	fallback: T,
	label: string,
): Promise<SafeDefaultResult<T>> {
	try {
		return { value: await fn(), degraded: false }
	} catch (error) {
		log.warn(`safe-fetch[${label}] failed:`, error)
		return { value: fallback, degraded: true }
	}
}

// Canonical empty shapes for the read paths used by the data providers.
// Kept here so the same value is referenced consistently and we don't
// drift between layouts.

export const EMPTY_SPOT_LIST: SpotListResult = {
	items: [],
	nextCursor: null,
}

export const EMPTY_SAVED_SPOTS: SavedSpotsListResult = {
	items: [],
	nextCursor: null,
}

export const EMPTY_SAVED_SPOT_HEADS: SavedSpotHeadsListResult = {
	items: [],
	nextCursor: null,
}

export const EMPTY_VERIFIED_SPOTS: VerifiedSpotsListResult = {
	items: [],
	nextCursor: null,
}

export const EMPTY_WEATHER: SpotWeather = {
	current: null,
	icon: "sunny",
	description: "",
	tempMin: null,
	tempMax: null,
	wind: null,
	humidity: null,
	precipitationMm: null,
	fetchedAt: 0,
}
