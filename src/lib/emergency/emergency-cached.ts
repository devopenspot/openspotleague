import { cacheLife, cacheTag } from "next/cache"
import { log } from "@/lib/utils/log"
import { fetchEmergencyNumbers } from "./fetchers"
import type { EmergencyNumbers } from "./types"

// Per-country cache: emergency dispatch numbers change on the
// order of years, not hours, so a 24h revalidate is well past the
// upstream's mutation cadence. `stale` matches `revalidate` so a
// revalidate tick during a render serves the previous value for
// the rest of the window. `expire` is a 7d ceiling so a forgotten
// country doesn't stay warm forever if the upstream ever drops a
// row from its response.
//
// The per-iso2 cache tag is the revalidation handle for a future
// admin country-mutation path, which can call
// `revalidateTag("emergency:iso2:{XX}", LIST_CACHE_LIFE)` to
// invalidate a single country without nuking the rest.
const EMERGENCY_CACHE_LIFE = {
	revalidate: 86_400,
	stale: 86_400,
	expire: 604_800,
} as const

/**
 * Resolves the emergency dispatch DTO for a single ISO 3166-1
 * alpha-2 code. Returns `null` on transport / non-OK / config
 * errors — callers must treat `null` as "no data available" and
 * leave the UI control disabled.
 *
 * Abort / timeout errors are re-thrown so the API route can
 * surface a 504 distinct from a generic 502. The cache
 * boundary itself does not start an `AbortController`; the 8s
 * timer lives in the fetcher.
 *
 * `"use cache"` is per-`iso2` so the upstream is hit about once
 * per 24h per country.
 */
export async function getEmergencyNumbers(
	iso2: string,
): Promise<EmergencyNumbers | null> {
	"use cache"
	cacheTag("emergency", `emergency:iso2:${iso2.toUpperCase()}`)
	cacheLife(EMERGENCY_CACHE_LIFE)

	try {
		return await fetchEmergencyNumbers(iso2)
	} catch (error) {
		const isAbort =
			error instanceof Error &&
			(error.name === "AbortError" || error.name === "TimeoutError")
		if (isAbort) throw error
		log.warn(`getEmergencyNumbers(${iso2}) failed:`, error)
		return null
	}
}
