/**
 * Subset of the Nominatim `/reverse` JSON response shape we depend on.
 * The full upstream schema is documented at
 * https://nominatim.org/release-docs/develop/api/Reverse/ — we only model
 * the fields we read so the projector can stay defensive against upstream
 * shape changes.
 */
export interface NominatimAddress {
  house_number?: string
  road?: string
  neighbourhood?: string
  suburb?: string
  village?: string
  town?: string
  city?: string
  municipality?: string
  county?: string
  state?: string
  region?: string
  postcode?: string
  country?: string
  country_code?: string
  continent?: string
  [key: string]: string | undefined
}

export interface NominatimNameDetails {
  name?: string
  [key: string]: string | undefined
}

export interface NominatimResponse {
  place_id: number
  licence?: string
  osm_type?: string
  osm_id?: number
  lat: string
  lon: string
  display_name: string
  type?: string
  class?: string
  importance?: number
  address?: NominatimAddress
  extratags?: Record<string, string>
  namedetails?: NominatimNameDetails
  boundingbox?: string[]
}
