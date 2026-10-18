/**
 * Domain types for the Emergency Number API integration.
 *
 * The upstream payload is documented at
 * https://emergencynumberapi.com — we model only the fields the
 * map's one-tap "Emergency" chip actually reads. The cached
 * service layer (`getEmergencyNumbers`) returns `null` on any
 * thrown error, so callers must treat `primary` as optional.
 *
 * `EmergencyConfigError` is thrown by the fetcher when env is
 * missing; `EmergencyFetchError` is thrown for any non-OK
 * upstream response or transport failure. The cached service
 * catches both and returns `null`.
 */

export class EmergencyConfigError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "EmergencyConfigError"
	}
}

export class EmergencyFetchError extends Error {
	readonly status: number

	constructor(status: number, message: string) {
		super(message)
		this.name = "EmergencyFetchError"
		this.status = status
	}
}

export type EmergencyService = "police" | "ambulance" | "fire" | "dispatch"

/**
 * Subset of the upstream `response.data.country` payload we project
 * through to the client. Drops `ISONumeric` and the disclaimer
 * field per SPEC. The shape is stable across the upstream's
 * `/api/country/{iso2}` endpoint.
 */
export interface EmergencyNumbers {
	country: {
		name: string
		iso2: string
	}
	primary: {
		number: string
		service: EmergencyService
	} | null
	all: {
		police: readonly string[]
		ambulance: readonly string[]
		fire: readonly string[]
		dispatch: readonly string[]
		member112: boolean
	}
}
