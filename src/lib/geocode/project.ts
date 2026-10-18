import type { NominatimResponse } from "./nominatim-types"

export type { NominatimResponse } from "./nominatim-types"

/**
 * Stable address shape returned by the geocode API. The upstream Nominatim
 * payload changes across versions and locales; the route always passes
 * the raw response through this projector so the client only sees a
 * predictable contract.
 */
export interface ProjectedAddress {
  displayName: string
  name: string | null
  road: string | null
  houseNumber: string | null
  city: string | null
  suburb: string | null
  state: string | null
  country: string | null
  countryCode: string | null
  lat: number
  lon: number
}

function first<T>(...values: ReadonlyArray<T | undefined | null>): T | null {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== "") return v
  }
  return null
}

export function projectAddress(raw: NominatimResponse): ProjectedAddress {
  const a = raw.address ?? {}
  const lat = Number(raw.lat)
  const lon = Number(raw.lon)
  return {
    displayName: raw.display_name,
    name: raw.namedetails?.name ?? null,
    road: first(a.road),
    houseNumber: first(a.house_number),
    city: first(a.city, a.town, a.village, a.municipality),
    suburb: first(a.suburb, a.neighbourhood),
    state: first(a.state, a.region, a.county),
    country: first(a.country),
    countryCode: a.country_code ? a.country_code.toUpperCase() : null,
    lat: Number.isFinite(lat) ? lat : 0,
    lon: Number.isFinite(lon) ? lon : 0,
  }
}
