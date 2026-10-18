"use client"

import type { ImageSourceFieldValue } from "./ImageSourceField"
import { NewSpotSchema } from "@/lib/schemas/spot"
import { normalizeCitySlug } from "@/lib/sport-events/validation"
import { SPORT_DISCIPLINES, type SportDiscipline } from "@/types/sport-events"
import type { Spot } from "@/lib/types"

export interface SpotFormState {
  name: string
  city: string
  citySlug: string
  address: string
  country: string
  countryCode: string
  types: string[]
  sports: SportDiscipline[]
  image: ImageSourceFieldValue
  lat: number
  lon: number
  instagram: string
}

export type SpotFormErrorKey = keyof SpotFormState | "location"
export type SpotFormErrors = Partial<Record<SpotFormErrorKey, string>>

export function buildInitialSpotState(initialTypeSlug?: string): SpotFormState {
  return {
    name: "",
    city: "",
    citySlug: "",
    address: "",
    country: "",
    countryCode: "",
    types: initialTypeSlug ? [initialTypeSlug] : [],
    sports: [],
    image: { imageUrl: "", file: null },
    lat: 0,
    lon: 0,
    instagram: "",
  }
}

export function stateFromSpot(spot: Spot): SpotFormState {
  return {
    name: spot.name,
    city: spot.city,
    citySlug: spot.citySlug,
    address: spot.address,
    country: spot.country,
    countryCode: spot.countryCode,
    types: spot.types.map((t) => t.slug),
    sports: spot.sports.filter((s): s is SportDiscipline =>
      SPORT_DISCIPLINES.includes(s as SportDiscipline),
    ),
    image: { imageUrl: spot.image, file: null },
    lat: spot.location.lat,
    lon: spot.location.lon,
    instagram: spot.instagram ?? "",
  }
}

function buildValidationCandidate(state: SpotFormState) {
  const hasCoord = !(state.lat === 0 && state.lon === 0)
  const rawImage = state.image.imageUrl.trim()
  const filePresent = Boolean(state.image.file)
  // image can be empty for patch (no-op) but NewSpotSchema requires valid image;
  // file presence satisfies via CDN URL placeholder at submit time — validation mirrors API
  const image = rawImage || (filePresent ? "https://spots.cdn.openspotleague.com/pending" : "")

  return {
    name: state.name.trim(),
    city: state.city.trim(),
    ...(state.citySlug.trim() ? { citySlug: state.citySlug.trim() } : {}),
    address: state.address.trim(),
    types: state.types,
    sports: state.sports,
    image,
    ...(state.country.trim() ? { country: state.country.trim() } : { country: "" }),
    ...(state.countryCode.trim()
      ? { countryCode: state.countryCode.trim().toUpperCase() }
      : {}),
    ...(hasCoord ? { location: { lat: state.lat, lon: state.lon } } : {}),
    ...(state.instagram.trim() ? { instagram: state.instagram.trim() } : { instagram: null }),
  }
}

export function validateSpotFormState(state: SpotFormState): SpotFormErrors {
  const errors: SpotFormErrors = {}

  if (!state.name.trim()) errors.name = "Spot name is required."
  if (!state.city.trim()) errors.city = "City is required."
  if (!state.country.trim() && !state.countryCode.trim()) errors.country = "Country is required."
  if (!state.countryCode.trim()) errors.country = errors.country ?? "Pick a country from the list."
  if (state.types.length === 0) errors.types = "Pick at least one spot type."
  if (state.sports.length === 0) errors.sports = "Pick at least one discipline."
  if (state.lat === 0 && state.lon === 0) errors.location = "Set coordinates via the map lookup."

  if (!Number.isFinite(state.lat) || !Number.isFinite(state.lon)) {
    errors.location = "Enter numeric latitude and longitude."
  } else {
    if (state.lat < -90 || state.lat > 90) errors.location = "Latitude must be between -90 and 90."
    if (state.lon < -180 || state.lon > 180) errors.location = errors.location ?? "Longitude must be between -180 and 180."
  }

  if (state.instagram.trim()) {
    try {
      const u = new URL(state.instagram.trim())
      if (u.protocol !== "http:" && u.protocol !== "https:") errors.instagram = "Instagram URL must use HTTP or HTTPS."
    } catch {
      errors.instagram = "Instagram URL must be a valid URL."
    }
  }

  const candidate = buildValidationCandidate(state)
  const result = NewSpotSchema.safeParse(candidate)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0]
      if (!message) continue
      if (field === "location") {
        errors.location ??= message
        continue
      }
      if (field === "types") {
        errors.types ??= message
        continue
      }
      if (field === "sports") {
        errors.sports ??= message
        continue
      }
      if (field === "countryCode") {
        errors.country ??= message
        continue
      }
      if (field === "instagram") {
        errors.instagram ??= message
        continue
      }
      if (field in state) {
        const key = field as keyof SpotFormState
        errors[key] ??= message
      }
    }
  }

  return errors
}

export function normalizeSpotCitySlug(value: string): string {
  return normalizeCitySlug(value)
}

export function buildSpotFormData(
  state: SpotFormState,
  mode: "create" | "edit",
  expectedUpdatedAt?: string,
  initialImageUrl?: string,
): FormData {
  const fd = new FormData()
  fd.set("name", state.name)
  fd.set("city", state.city)
  fd.set("citySlug", state.citySlug)
  fd.set("address", state.address)
  fd.set("country", state.country)
  fd.set("countryCode", state.countryCode)
  for (const t of state.types) fd.append("type", t)
  for (const sport of state.sports as readonly SportDiscipline[]) fd.append("sports", sport)

  // Avoid overwriting private signed URL when unchanged (mirrors edit helper)
  if (mode === "edit" && initialImageUrl !== undefined && state.image.imageUrl !== initialImageUrl) {
    fd.set("imageUrl", state.image.imageUrl)
  } else if (mode === "create") {
    fd.set("imageUrl", state.image.imageUrl)
  } else if (state.image.imageUrl !== initialImageUrl) {
    fd.set("imageUrl", state.image.imageUrl)
  }

  fd.set("lat", String(state.lat))
  fd.set("lon", String(state.lon))
  fd.set("instagram", state.instagram)
  if (expectedUpdatedAt) fd.set("expectedUpdatedAt", expectedUpdatedAt)
  if (state.image.file) fd.set("image", state.image.file)
  return fd
}

export function errorsFromSpotApiDetails(details: unknown): SpotFormErrors {
  if (!details || typeof details !== "object") return {}
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors
  if (!fieldErrors || typeof fieldErrors !== "object") return {}

  const errors: SpotFormErrors = {}
  const initial = buildInitialSpotState()
  for (const [field, value] of Object.entries(fieldErrors)) {
    if (!Array.isArray(value) || typeof value[0] !== "string") continue
    if (field === "location" || field === "lat" || field === "lon") {
      errors.location = value[0]
    } else if (field === "countryCode" || field === "country") {
      errors.country = value[0]
    } else if (field in initial) {
      errors[field as keyof SpotFormState] = value[0]
    }
  }
  return errors
}
