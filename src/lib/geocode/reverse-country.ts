import { env } from "@/lib/config/env"
import type { NominatimResponse } from "@/lib/geocode/project"

const REVERSE_TIMEOUT_MS = 8_000

export class ReverseCountryError extends Error {
  constructor(
    message: string,
    public readonly status: "not_found" | "upstream" | "timeout" = "upstream",
  ) {
    super(message)
    this.name = "ReverseCountryError"
  }
}

export async function reverseGeocodeCountry(
  lat: number,
  lon: number,
): Promise<{ country: string; countryCode: string }> {
  const url = new URL("/reverse", env.NOMINATIM_URL)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lon))
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("zoom", "3")

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
    if (!response.ok) throw new ReverseCountryError("Reverse geocode failed")

    const result = (await response.json()) as NominatimResponse & { error?: string }
    const country = result.address?.country?.trim()
    const countryCode = result.address?.country_code?.trim().toUpperCase()
    if (!country || !countryCode) {
      throw new ReverseCountryError(
        "No country found for these coordinates",
        "not_found",
      )
    }
    return { country, countryCode }
  } catch (error) {
    if (error instanceof ReverseCountryError) throw error
    if (error instanceof Error && error.name === "AbortError") {
      throw new ReverseCountryError("Reverse geocode timed out", "timeout")
    }
    throw new ReverseCountryError("Reverse geocode unavailable")
  } finally {
    clearTimeout(timer)
  }
}
