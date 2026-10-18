import type { ImageSourceFieldValue } from "@/components/admin/spots/form/ImageSourceField"
import { NewSportEventSchema } from "@/lib/schemas/event"
import { normalizeCitySlug } from "@/lib/sport-events/validation"
import type {
  SportDiscipline,
  SportEvent,
} from "@/types/sport-events"
import type { SportEventCategory } from "@/types/sport-events"

export { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_OPTIONS } from "./event-options"

export interface EventFormState {
  name: string
  shortName: string
  url: string
  image: ImageSourceFieldValue
  description: string
  sports: SportDiscipline[]
  startDate: string
  endDate: string
  city: string
  citySlug: string
  address: string
  country: string
  countryCode: string
  venue: string
  latitude: string
  longitude: string
  category: SportEventCategory
  featured: boolean
  instagram: string
  youtube: string
}

export type EventFormErrorKey =
  | keyof EventFormState
  | "location"

export type EventFormErrors = Partial<Record<EventFormErrorKey, string>>

export function buildInitialEventState(): EventFormState {
  return {
    name: "",
    shortName: "",
    url: "",
    image: { imageUrl: "", file: null },
    description: "",
    sports: [],
    startDate: "",
    endDate: "",
    city: "",
    citySlug: "",
    address: "",
    country: "",
    countryCode: "",
    venue: "",
    latitude: "",
    longitude: "",
    category: "festival",
    featured: false,
    instagram: "",
    youtube: "",
  }
}

export function stateFromEvent(event: SportEvent): EventFormState {
  return {
    name: event.name,
    shortName: event.shortName ?? "",
    url: event.url ?? "",
    image: { imageUrl: event.image, file: null },
    description: event.description,
    sports: [...event.sports],
    startDate: event.startDate,
    endDate: event.endDate ?? "",
    city: event.location.city,
    citySlug: event.location.citySlug ?? "",
    address: event.location.address ?? "",
    country: event.location.country,
    countryCode: event.location.countryCode ?? "",
    venue: event.location.venue ?? "",
    latitude:
      event.location.latitude !== undefined
        ? String(event.location.latitude)
        : "",
    longitude:
      event.location.longitude !== undefined
        ? String(event.location.longitude)
        : "",
    category: event.category,
    featured: event.featured ?? false,
    instagram: event.instagram ?? "",
    youtube: event.youtube ?? "",
  }
}

function asNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : undefined
}

function imageValue(state: EventFormState): string {
  return state.image.imageUrl.trim() || "https://events.cdn.openspotleague.com/pending"
}

function normalizeDateInput(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function buildValidationCandidate(state: EventFormState) {
  const latitude = asNumber(state.latitude)
  const longitude = asNumber(state.longitude)
  const endDate = normalizeDateInput(state.endDate)

  return {
    name: state.name.trim(),
    url: state.url.trim(),
    image: state.image.file || state.image.imageUrl.trim() ? imageValue(state) : "",
    description: state.description,
    sports: state.sports,
    startDate: state.startDate,
    ...(endDate ? { endDate } : {}),
    city: state.city.trim(),
    ...(state.citySlug.trim()
      ? { citySlug: state.citySlug.trim() }
      : {}),
    ...(state.address.trim() ? { address: state.address.trim() } : {}),
    country: state.country.trim(),
    ...(state.countryCode.trim()
      ? { countryCode: state.countryCode.trim().toUpperCase() }
      : {}),
    ...(state.venue.trim() ? { venue: state.venue.trim() } : {}),
    ...(latitude !== undefined && longitude !== undefined
      ? { latitude, longitude }
      : {}),
    category: state.category,
    featured: state.featured,
    instagram: state.instagram.trim() || null,
    youtube: state.youtube.trim() || null,
  }
}

export function validateEventFormState(state: EventFormState): EventFormErrors {
  const errors: EventFormErrors = {}
  const latitude = asNumber(state.latitude)
  const longitude = asNumber(state.longitude)

  if (!state.name.trim()) errors.name = "Event name is required."
  if (!state.url.trim()) errors.url = "Add the event's official URL."
  if (!state.image.imageUrl.trim() && !state.image.file) {
    errors.image = "Add an image URL or choose an image file."
  }
  if (!state.startDate) errors.startDate = "Start date is required."
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(state.startDate)) {
    errors.startDate = "Start date must use YYYY-MM-DD."
  }
  const normalizedEnd = normalizeDateInput(state.endDate)
  if (normalizedEnd && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedEnd)) {
    errors.endDate = "End date must use YYYY-MM-DD."
  }
  // Early cross-field check so the UI shows the range error without awaiting Zod.
  if (state.startDate && normalizedEnd && normalizedEnd < state.startDate) {
    errors.endDate = "End date must be on or after the start date."
  }
  if (!state.city.trim()) errors.city = "City is required."
  if (!state.country.trim()) errors.country = "Country is required."

  if (!state.latitude.trim() || !state.longitude.trim()) {
    errors.location = "Latitude and longitude are required for an event."
  } else if (latitude === undefined || longitude === undefined) {
    errors.location = "Enter numeric latitude and longitude."
  }

  const result = NewSportEventSchema.safeParse(buildValidationCandidate(state))
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0]
      if (!message) continue
      if (field === "latitude" || field === "longitude") {
        errors.location ??= message
        continue
      }
      // Calendar / range errors from Zod should not overwrite the friendlier
      // early checks above; they are kept only as fallback.
      if (field === "endDate" && errors.endDate) continue
      if (field === "startDate" && errors.startDate) continue
      if (field in state) {
        const key = field as keyof EventFormState
        errors[key] ??= message
      }
    }
  }
  // If Zod produced a range issue but early check missed due to format, surface it.
  if (!errors.endDate && state.startDate && normalizedEnd) {
    const zodEnd = result.success ? undefined : result.error.flatten().fieldErrors["endDate"]?.[0]
    if (zodEnd && zodEnd.includes("on or after")) errors.endDate = zodEnd
  }

  return errors
}

export function normalizeEventCitySlug(value: string): string {
  return normalizeCitySlug(value)
}

export function buildEventFormData(
  state: EventFormState,
  mode: "create" | "edit",
  expectedUpdatedAt?: string,
  initialImageUrl?: string,
): FormData {
  const formData = new FormData()
  formData.set("name", state.name)
  formData.set("url", state.url)
  // Always set startDate — it is required for both create and edit. EndDate
  // semantics: "" on edit means "clear to one-day" (API maps "" → null),
  // omit on create means one-day.
  formData.set("startDate", state.startDate)
  formData.set("description", state.description)
  formData.set("city", state.city)
  formData.set("country", state.country)
  formData.set("category", state.category)
  formData.set("instagram", state.instagram)
  formData.set("youtube", state.youtube)
  if (expectedUpdatedAt) formData.set("expectedUpdatedAt", expectedUpdatedAt)

  if (state.shortName || mode === "edit") {
    formData.set("shortName", state.shortName)
  }
  // Avoid overwriting private/public URL when unchanged (mirrors spots)
  // Create: only send imageUrl if present (file-only -> omit, server uses placeholder)
  // Edit: send only if changed vs initialImageUrl to avoid signed-URL echo; otherwise
  //       fall back to original "always on edit" semantics when initialImageUrl unavailable
  if (mode === "create") {
    if (state.image.imageUrl) formData.set("imageUrl", state.image.imageUrl)
  } else if (initialImageUrl !== undefined) {
    if (state.image.imageUrl !== initialImageUrl) formData.set("imageUrl", state.image.imageUrl)
  } else if (state.image.imageUrl || mode === "edit") {
    formData.set("imageUrl", state.image.imageUrl)
  }
  if (state.image.file) formData.set("image", state.image.file)
  if (normalizeDateInput(state.endDate) || mode === "edit") {
    // On edit we preserve "" so the PATCH can clear endAt; on create we omit when blank.
    formData.set("endDate", state.endDate.trim())
  }
  if (state.citySlug || mode === "edit") {
    formData.set("citySlug", state.citySlug)
  }
  if (state.address || mode === "edit") {
    formData.set("address", state.address)
  }
  if (state.countryCode || mode === "edit") {
    formData.set("countryCode", state.countryCode)
  }
  if (state.venue || mode === "edit") {
    formData.set("venue", state.venue)
  }
  if (state.latitude || mode === "edit") {
    formData.set("latitude", state.latitude)
  }
  if (state.longitude || mode === "edit") {
    formData.set("longitude", state.longitude)
  }

  for (const sport of state.sports) formData.append("sports", sport)
  if (mode === "edit" || state.featured) {
    formData.set("featured", state.featured ? "on" : "off")
  }

  return formData
}

export function errorsFromApiDetails(details: unknown): EventFormErrors {
  if (!details || typeof details !== "object") return {}
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors
  if (!fieldErrors || typeof fieldErrors !== "object") return {}

  const errors: EventFormErrors = {}
  for (const [field, value] of Object.entries(fieldErrors)) {
    if (!Array.isArray(value) || typeof value[0] !== "string") continue
    if (field === "latitude" || field === "longitude") {
      errors.location = value[0]
    } else if (field in buildInitialEventState()) {
      errors[field as keyof EventFormState] = value[0]
    }
  }
  return errors
}
