import { env } from "@/lib/config/env"
import { projectAddress, type NominatimResponse } from "@/lib/geocode/project"

const REVERSE_TIMEOUT_MS = 8_000

export type AutoAddress = {
  city: string
  address: string
  country: string
  countryCode: string | null
}

/**
 * Street-level reverse geocode for a rider's quick-add spot (game setup).
 * Returns null when the upstream has no answer; callers decide the fallback.
 * Server-only: Nominatim allows 1 req/sec, so it sits behind the spot-create
 * rate limit and is never exposed as an open endpoint.
 */
export async function reverseGeocodeAddress(
  lat: number,
  lon: number,
): Promise<AutoAddress | null> {
  const url = new URL("/reverse", env.NOMINATIM_URL)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lon))
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("zoom", "18")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REVERSE_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": env.NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    })
    if (!response.ok) return null
    const raw = (await response.json()) as NominatimResponse & { error?: string }
    if (raw.error) return null
    const projected = projectAddress(raw)
    if (!projected.country) return null
    const street = [projected.road, projected.houseNumber].filter(Boolean).join(" ")
    const city = projected.city ?? projected.suburb ?? projected.state ?? projected.country
    return {
      city,
      address: street || projected.suburb || city,
      country: projected.country,
      countryCode: projected.countryCode,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
