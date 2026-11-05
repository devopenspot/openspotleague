import { cacheLife, cacheTag } from "next/cache"
import { getEventRepositoryAsync } from "@/lib/repositories"
import type { MapEvent, Contest, ContestEnriched } from "@/types/league"
import type { EventShuffleFilters } from "@/lib/repositories/core/types"
import type { SportEventQuery } from "@/lib/repositories/event/event-repository"
import { decodeRandomSpotCursor, encodeRandomSpotCursor } from "@/lib/repositories/spot/spot-pagination"
import { seededShuffle } from "@/lib/utils/seeded-random"
import { EVENT_LIST_HARD_CAP } from "@/lib/config/constants"
import { deriveStatus } from "@/lib/league/status"
import { selectFeaturedEvent } from "@/lib/league/featured"
import { projectMapEvents } from "@/lib/league/map-projection"

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function toUTCDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function formatDateRange(event: Contest): string {
  const start = toUTCDate(event.startDate)
  const startLabel = MONTH_FORMAT.format(start).toUpperCase()

  if (!event.endDate) {
    return MONTH_YEAR_FORMAT.format(start).toUpperCase()
  }

  const end = toUTCDate(event.endDate)
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const endLabelBase = sameYear
    ? MONTH_FORMAT.format(end).toUpperCase()
    : MONTH_YEAR_FORMAT.format(end).toUpperCase()

  const year = start.getUTCFullYear()
  if (startLabel.split(" ")[0] === endLabelBase.split(" ")[0]) {
    const startDay = start.getUTCDate()
    const endDay = end.getUTCDate()
    return `${startLabel.split(" ")[0]} ${startDay}–${endDay}, ${year}`.toUpperCase()
  }
  return `${startLabel} – ${endLabelBase}, ${year}`.toUpperCase()
}

function enrich(event: Contest, now: Date): ContestEnriched {
  return {
    ...event,
    status: deriveStatus(event, now),
    dateRangeLabel: formatDateRange(event),
  }
}

function enrichAll(
  items: readonly Contest[],
  now: Date,
): readonly ContestEnriched[] {
  return Object.freeze(items.map((e) => enrich(e, now)))
}

import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

// ---------- list ----------

export async function runListEvents(
  query?: SportEventQuery,
): Promise<SportEventEnrichedListResult> {
  if (query?.random && query.seed) return runListEventsRandom(query)
  const repo = await getEventRepositoryAsync()
  const result = await repo.list(query)
  return {
    ...result,
    items: enrichAll(result.items, new Date()),
  }
}

// ---------- shuffle pagination (landing wire / explore) ----------
//
// Same model as `listSpotCards`: the filtered ID list is cached by
// filter (shared across visitors — the per-visitor seed never enters
// the cache key), the shuffle/slice happens in memory, and only the
// page's rows are fetched. Shares the `events:list` tag, so every
// event mutation invalidates it via `revalidateEventCaches`.

export function toEventShuffleFilters(query: SportEventQuery): EventShuffleFilters {
  const { cursor, seed, random, limit, ...filters } = query
  void cursor
  void seed
  void random
  void limit
  return filters
}

export async function listEventShuffleIds(
  filters: EventShuffleFilters,
): Promise<readonly string[]> {
  "use cache: remote"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  const repo = await getEventRepositoryAsync()
  return repo.listShuffledIds(filters)
}

export async function runListEventsRandom(
  query: SportEventQuery,
): Promise<SportEventEnrichedListResult> {
  if (!query.seed) {
    return runListEvents({ ...query, random: false, seed: undefined })
  }
  const limit = Math.min(query.limit ?? 50, EVENT_LIST_HARD_CAP)
  const ids = await listEventShuffleIds(toEventShuffleFilters(query))
  if (ids.length === 0) return { items: [], nextCursor: null, hasMore: false }
  const cursor = decodeRandomSpotCursor(query.cursor)
  const startIndex = cursor && cursor.seed === query.seed ? cursor.index : 0
  const pageIds = seededShuffle(ids, query.seed).slice(startIndex, startIndex + limit)
  if (pageIds.length === 0) return { items: [], nextCursor: null, hasMore: false }
  const repo = await getEventRepositoryAsync()
  const events = await repo.listByIds(pageIds)
  const byId = new Map(events.map((event) => [event.id, event]))
  const ordered = pageIds
    .map((id) => byId.get(id))
    .filter((event): event is Contest => event !== undefined)
  const nextIndex = startIndex + pageIds.length
  const nextCursor =
    nextIndex < ids.length ? encodeRandomSpotCursor({ seed: query.seed, index: nextIndex }) : null
  return {
    items: enrichAll(ordered, new Date()),
    nextCursor,
    hasMore: nextCursor !== null,
  }
}

export interface SportEventEnrichedListResult {
  items: readonly ContestEnriched[]
  nextCursor: string | null
  hasMore: boolean
}

export async function listEvents(
  query?: SportEventQuery,
): Promise<SportEventEnrichedListResult> {
  "use cache"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListEvents(query)
}

export interface ContestDirectoryData {
  events: readonly ContestEnriched[]
  featured: ContestEnriched | undefined
}

/**
 * Loads the public directory in one cached read. Featured selection is a
 * projection of the same enriched list, not a second repository query.
 *
 * The repository pages at `EVENT_LIST_HARD_CAP` (200) rows — a single
 * call used to silently truncate the directory to the first-200
 * slice by `startAt` (lies to `StatusFilter`'s client-derived counts
 * and hides far-future/completed events). Page the same query by
 * cursor so the directory covers the full published catalog; the
 * bound is a safety valve, not a target.
 */
const EVENT_DIRECTORY_MAX_PAGES = 5

export async function runListContestDirectory(): Promise<ContestDirectoryData> {
  const items: ContestEnriched[] = []
  let cursor: string | undefined
  for (let page = 0; page < EVENT_DIRECTORY_MAX_PAGES; page++) {
    const result = await runListEvents(cursor ? { cursor } : undefined)
    if (result.items.length === 0) break
    items.push(...result.items)
    if (!result.nextCursor) break
    cursor = result.nextCursor
  }
  return { events: items, featured: selectFeaturedEvent(items) }
}

export async function listContestDirectory(): Promise<ContestDirectoryData> {
  "use cache: remote"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListContestDirectory()
}

// ---------- map projection ----------
//
// `listEventsForMap` is the read path the `/map` layout uses to render
// the events layer. It deliberately:
//   1. Uses the same short-lived cache profile as the public event list.
//      Event mutations invalidate the shared `events:list` tag, so the
//      map does not need to execute the full query on every request.
//   2. Filters by `citySlug` at the DB, not on the client — the events
//      layer is capped at the spec's 50 markers, and filtering at the
//      DB keeps the payload tight.
//   3. Returns a minimal DTO (`MapEvent`) — the map does not need the
//      description, social links, full address, etc. The shape is the
//      minimum needed by `EventMarker` + `MapInfoPopup`.
//   4. Skips events that have no coordinates — a `ContestLocation`
//      without `latitude` / `longitude` cannot be plotted on Leaflet.
//
// `EVENTS_FOR_MAP_LIMIT` is the hard cap on markers the map will
// render. P2 in SPEC §7.10.
export const EVENTS_FOR_MAP_LIMIT = 50;

export async function listEventsForMap(
  citySlug: string | null,
): Promise<readonly MapEvent[]> {
  "use cache: remote"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  const repo = await getEventRepositoryAsync()
  const events = enrichAll(
    await repo.listMap({
      citySlug: citySlug ?? undefined,
      limit: EVENTS_FOR_MAP_LIMIT,
    }),
    new Date(),
  )
  return projectMapEvents(events, EVENTS_FOR_MAP_LIMIT);
}

// ---------- findById ----------

export async function runFindEventById(
  id: string,
): Promise<ContestEnriched | null> {
  const repo = await getEventRepositoryAsync()
  const event = await repo.findById(id)
  if (!event) return null
  const events = enrichAll([event], new Date())
  return events[0] ?? null
}

// ---------- findBySlug ----------
// Slug lookup reuses the cached `events:list` so it needs no extra index
// and benefits from the same invalidation on mutation. Next 16 requires the
// same `cacheTag`/`cacheLife` pair to hit the cached list.

export async function runFindEventBySlug(
  slug: string,
): Promise<ContestEnriched | null> {
  const { items } = await runListEvents()
  const decoded = decodeURIComponent(slug)
  return items.find((e) => e.slug === slug || e.slug === decoded) ?? null
}

export async function findEventBySlug(
  slug: string,
): Promise<ContestEnriched | null> {
  "use cache"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  return runFindEventBySlug(slug)
}
