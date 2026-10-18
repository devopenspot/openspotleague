import { env } from "@/lib/config/env"
import {
	EmergencyConfigError,
	EmergencyFetchError,
	type EmergencyNumbers,
	type EmergencyService,
} from "./types"

// Subset of the upstream response we care about. Defensive against
// upstream shape changes — every field is read through optional
// chaining and falls back to a safe default before the projector
// runs.
interface UpstreamCountry {
	name?: string
	iso2?: string
	ISONumeric?: string
	dispatch?: { all?: string[]; police?: string[]; ambulance?: string[]; fire?: string[] }
	police?: { all?: string[] }
	ambulance?: { all?: string[] }
	fire?: { all?: string[] }
	member_112?: boolean
	disclaimer?: string
}

interface UpstreamPayload {
	status?: string
	data?: {
		country?: UpstreamCountry
	}
}

const FETCH_TIMEOUT_MS = 8_000

/**
 * Thin fetch wrapper for the Emergency Number API. Reads the
 * upstream response for `iso2` (uppercased on the wire) and
 * projects it into a stable DTO. Throws:
 *   - `EmergencyConfigError` if `EMERGENCY_API_URL` is unset.
 *   - `EmergencyFetchError` on any non-OK upstream response.
 *   - The original `Error` (caller catches) on transport failure
 *     or abort — the cached service turns any thrown error into
 *     a `null` return.
 */
export async function fetchEmergencyNumbers(
	iso2: string,
): Promise<EmergencyNumbers> {
	const base = env.EMERGENCY_API_URL
	if (!base) {
		throw new EmergencyConfigError(
			"Emergency API URL is not set (EMERGENCY_API_URL).",
		)
	}
	const url = `${base.replace(/\/+$/, "")}/api/country/${iso2.toLowerCase()}`

	const ac = new AbortController()
	const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent": env.EMERGENCY_USER_AGENT,
				Accept: "application/json",
			},
			cache: "no-store",
			signal: ac.signal,
		})
		if (!response.ok) {
			throw new EmergencyFetchError(
				response.status,
				`Emergency API failed: ${response.status}`,
			)
		}
		const raw = (await response.json()) as UpstreamPayload
		return projectEmergencyNumbers(raw, iso2)
	} finally {
		clearTimeout(timer)
	}
}

function projectEmergencyNumbers(
	raw: UpstreamPayload,
	fallbackIso2: string,
): EmergencyNumbers {
	const country = raw.data?.country
	const dispatchAll = country?.dispatch?.all ?? []
	const primaryNumber = dispatchAll[0] ?? null
	const primaryService: EmergencyService | null = primaryNumber
		? "dispatch"
		: null
	return {
		country: {
			name: country?.name ?? fallbackIso2,
			iso2: country?.iso2 ?? fallbackIso2,
		},
		primary:
			primaryNumber && primaryService
				? { number: primaryNumber, service: primaryService }
				: null,
		all: {
			police: country?.police?.all ?? [],
			ambulance: country?.ambulance?.all ?? [],
			fire: country?.fire?.all ?? [],
			dispatch: dispatchAll,
			member112: country?.member_112 ?? false,
		},
	}
}
