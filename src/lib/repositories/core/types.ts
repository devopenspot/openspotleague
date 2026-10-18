import type { z } from "zod"
import type { MapSpot, Spot } from "@/lib/types"
import type { SpotQuerySchema, NewSpotSchema, SpotPatchSchema } from "@/lib/schemas/spot"
import type {
  NewSportEventSchema,
  SportEventPatchSchema,
} from "@/lib/schemas/event"
import type { SportDiscipline, SportEventCategory } from "@/types/sport-events"

export type SpotQuery = z.infer<typeof SpotQuerySchema>
export type NewSpot = z.infer<typeof NewSpotSchema>
export type SpotPatch = z.infer<typeof SpotPatchSchema>

export type NewSportEvent = z.infer<typeof NewSportEventSchema>
export type SportEventPatch = z.infer<typeof SportEventPatchSchema>

export interface ContentDeleteResult {
  imagePath: string | null
  hidden?: boolean
  /**
   * Moderation detach counts (spot hard-deletes only) — surfaced for the
   * audit metadata and the moderation log line. Absent for hides and for
   * entities without dependents.
   */
  detachSummary?: SpotDetachSummary
}

/**
 * Counts returned by `detachSpotDependents`: how many rows each moderation
 * tier touched. Defined here (rather than next to the planner) so
 * `ContentDeleteResult` can reference it without core depending on a
 * domain module.
 */
export type SpotDetachSummary = {
  lobbiesDeleted: number
  challengesDetached: number
  trainingsDetached: number
  challengeRecordsSnapshotted: number
  weatherReportsDeleted: number
  locationVerificationsDeleted: number
}

export interface SpotModerationResult {
  hiddenSpotIds: readonly string[]
  hiddenCount: number
}

export interface SpotListResult {
  items: readonly Spot[]
  nextCursor: string | null
}

export interface MapSpotListResult {
  items: readonly MapSpot[]
  nextCursor: string | null
}

/**
 * Slim marquee projection of a spot — the only fields the landing wire
 * (`toMarqueeItems`) reads. Served by the card query path so pagination
 * never transfers full `Spot` rows (location, timestamps, type
 * aggregates) for 232px cards.
 */
export interface SpotCard {
  id: string
  name: string
  city: string
  image: string
  sports: readonly SportDiscipline[]
}

export interface SpotCardListResult {
  items: readonly SpotCard[]
  nextCursor: string | null
}

/**
 * Filter-only slice of `SpotQuery` that keys the cached shuffle ID list.
 * Excludes `seed` (per-visitor — must never enter a shared cache key),
 * `cursor`/`limit` (paging applies after the shuffle, in memory) and
 * `random` (implied). `near` is excluded: geo + random stays on the
 * deterministic path (see `listSpotCards`).
 */
export type SpotShuffleFilters = Omit<SpotQuery, "cursor" | "seed" | "random" | "limit" | "near">

/**
 * Filter-only slice of `SportEventQuery`, same contract as
 * `SpotShuffleFilters`: shared cache key for the event shuffle ID list.
 */
export interface EventShuffleFilters {
  q?: string
  country?: string
  citySlug?: string
  category?: SportEventCategory
  discipline?: SportDiscipline
  featured?: boolean
  from?: string
  to?: string
}

export interface SpotFacetCountry {
  name: string
  region: string
  count: number
}

export interface SpotFacetCountryForRegion {
  name: string
  count: number
}

export interface SpotFacetType {
  name: string
  count: number
}

export interface SpotFacetRegion {
  name: string
  countryCount: number
  spotCount: number
  /**
   * Public, non-hidden spot counts keyed by country display name for
   * this region. Powers the searcher's country drill-down so its
   * per-country numbers come from the DB aggregate instead of the
   * capped 500-item directory the client holds.
   */
  byCountry: readonly SpotFacetCountryForRegion[]
}

/**
 * City facet for the searcher's city drill-down: the distinct city slugs
 * (and a display name) of the public, non-hidden spots for one country,
 * ordered by true spot count (server-side) so the overlay can render a
 * complete, correctly-ordered list without shipping count numbers —
 * per-city counts are display-irrelevant and were dropped.
 */
export interface SpotFacetCity {
  /** Canonical `spots.city_slug`, used by the `city` URL param. */
  slug: string
  name: string
}

export interface SportEventFacetCountry {
  name: string
  count: number
}

export interface SportEventFacetCategory {
  name: SportEventCategory
  count: number
}

export interface SportEventFacetDiscipline {
  name: SportDiscipline
  count: number
}
