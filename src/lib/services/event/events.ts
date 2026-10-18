import { cacheLife, cacheTag, revalidatePath, revalidateTag } from "next/cache"
import { getEventRepositoryAsync } from "@/lib/repositories"
import type {
  MapEvent,
  SportEvent,
  SportEventEnriched,
} from "@/types/sport-events"
import type {
  NewSportEvent,
  EventShuffleFilters,
  SportEventPatch,
} from "@/lib/repositories/core/types"
import type {
  SportEventListResult,
  SportEventQuery,
} from "@/lib/repositories/event/event-repository"
import { decodeRandomSpotCursor, encodeRandomSpotCursor } from "@/lib/repositories/spot/spot-pagination"
import { seededShuffle } from "@/lib/utils/seeded-random"
import { EVENT_LIST_HARD_CAP } from "@/lib/config/constants"
import { deriveStatus } from "@/lib/sport-events/status"
import { selectFeaturedEvent } from "@/lib/sport-events/featured"
import { projectMapEvents } from "@/lib/sport-events/map-projection"

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

function formatDateRange(event: SportEvent): string {
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

function enrich(event: SportEvent, now: Date): SportEventEnriched {
  return {
    ...event,
    status: deriveStatus(event, now),
    dateRangeLabel: formatDateRange(event),
  }
}

function enrichAll(
  items: readonly SportEvent[],
  now: Date,
): readonly SportEventEnriched[] {
  return Object.freeze(items.map((e) => enrich(e, now)))
}

import {
  IMAGE_CACHE_LIFE,
  ITEM_CACHE_LIFE,
  LIST_CACHE_LIFE,
} from "@/lib/cache/lifetimes"

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
  "use cache"
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
    .filter((event): event is SportEvent => event !== undefined)
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
  items: readonly SportEventEnriched[]
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

export interface SportEventsDirectoryData {
  events: readonly SportEventEnriched[]
  featured: SportEventEnriched | undefined
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

export async function runListEventDirectory(): Promise<SportEventsDirectoryData> {
  const items: SportEventEnriched[] = []
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

export async function listEventDirectory(): Promise<SportEventsDirectoryData> {
  "use cache"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListEventDirectory()
}

// Marquee: 12 random events, seeded per-visit. Routes through the
// shuffle-ID cache (`runListEventsRandom`) — no full-table ID scan.
export async function runGetMarqueeEvents(seed?: string): Promise<readonly SportEventEnriched[]> {
  const { items } = await runListEvents(seed ? { limit: 12, random: true, seed } : { limit: 12 })
  return items
}

export async function getMarqueeEvents(seed?: string): Promise<readonly SportEventEnriched[]> {
  "use cache"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  return runGetMarqueeEvents(seed)
}

export async function getEventsCount(): Promise<number> {
  "use cache"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  const repo = await getEventRepositoryAsync()
  return repo.count()
}

export async function runListEventsRaw(
  query?: SportEventQuery,
): Promise<SportEventListResult> {
  const repo = await getEventRepositoryAsync()
  return repo.list(query)
}

export async function listEventsRaw(
  query?: SportEventQuery,
): Promise<SportEventListResult> {
  "use cache"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListEventsRaw(query)
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
//   4. Skips events that have no coordinates — a `SportEventLocation`
//      without `latitude` / `longitude` cannot be plotted on Leaflet.
//
// `EVENTS_FOR_MAP_LIMIT` is the hard cap on markers the map will
// render. P2 in SPEC §7.10.
export const EVENTS_FOR_MAP_LIMIT = 50;

export async function listEventsForMap(
  citySlug: string | null,
): Promise<readonly MapEvent[]> {
  "use cache"
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

// ---------- featured ----------
// Derives the featured event from the cached list (no separate DB
// call). Mutations that touch `featured` revalidate the
// `events:list` tag, which transitively invalidates this function.

export async function runFindFeaturedEvent(): Promise<
  SportEventEnriched | undefined
> {
  const { items } = await runListEvents()
  return selectFeaturedEvent(items)
}

export async function findFeaturedEvent(): Promise<
  SportEventEnriched | undefined
> {
  "use cache"
  cacheTag("events:list")
  cacheTag("events:featured")
  cacheLife(ITEM_CACHE_LIFE)
  return runFindFeaturedEvent()
}

// ---------- findById ----------

export async function runFindEventById(
  id: string,
): Promise<SportEventEnriched | null> {
  const repo = await getEventRepositoryAsync()
  const event = await repo.findById(id)
  if (!event) return null
  const events = enrichAll([event], new Date())
  return events[0] ?? null
}

export async function findEventById(
  id: string,
): Promise<SportEventEnriched | null> {
  "use cache"
  cacheTag(`events:item:${id}`)
  cacheLife(ITEM_CACHE_LIFE)
  return runFindEventById(id)
}

export async function findEventMediaState(id: string) {
  const repo = await getEventRepositoryAsync()
  return repo.findMediaState(id)
}

// ---------- findBySlug ----------
// Slug lookup reuses the cached `events:list` so it needs no extra index
// and benefits from the same invalidation on mutation. Next 16 requires the
// same `cacheTag`/`cacheLife` pair to hit the cached list.

export async function runFindEventBySlug(
  slug: string,
): Promise<SportEventEnriched | null> {
  const { items } = await runListEvents()
  const decoded = decodeURIComponent(slug)
  return items.find((e) => e.slug === slug || e.slug === decoded) ?? null
}

export async function findEventBySlug(
  slug: string,
): Promise<SportEventEnriched | null> {
  "use cache"
  cacheTag("events:list")
  cacheLife(LIST_CACHE_LIFE)
  return runFindEventBySlug(slug)
}

// ---------- mutators ----------

// Shared invalidation for every event mutation. Tags must match the ones
// declared by the `"use cache"` read services; profiles come from
// `@/lib/cache/lifetimes` (Next 16 requires the exact object reference).
function revalidateEventCaches(eventId: string, slug: string | null = null): void {
  revalidateTag("events:list", LIST_CACHE_LIFE)
  revalidateTag("events:featured", ITEM_CACHE_LIFE)
  revalidateTag(`events:item:${eventId}`, ITEM_CACHE_LIFE)
  revalidateTag("event-images", IMAGE_CACHE_LIFE)
  if (slug) revalidatePath(`/sport-events/${slug}`)
  revalidatePath("/sport-events")
  revalidatePath("/explore")
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath("/admin/events")
}

export async function runCreateEvent(
  input: NewSportEvent,
): Promise<SportEvent> {
  const repo = await getEventRepositoryAsync()
  return repo.create(input)
}

export async function createEvent(input: NewSportEvent): Promise<SportEvent> {
  const event = await runCreateEvent(input)
  revalidateEventCaches(event.id, event.slug)
  return event
}

export async function runUpdateEvent(
  id: string,
  patch: SportEventPatch,
  expectedUpdatedAt?: string,
  actorId?: string | null,
): Promise<SportEvent> {
  const repo = await getEventRepositoryAsync()
  return repo.update(id, patch, expectedUpdatedAt, actorId)
}

export async function updateEvent(
  id: string,
  patch: SportEventPatch,
  expectedUpdatedAt?: string,
  actorId?: string | null,
): Promise<SportEvent> {
  const event = await runUpdateEvent(id, patch, expectedUpdatedAt, actorId)
  revalidateEventCaches(id, event.slug)
  return event
}

export async function runDeleteEvent(
  id: string,
  expectedUpdatedAt?: string,
  actorId?: string | null,
) {
  const repo = await getEventRepositoryAsync()
  return repo.delete(id, expectedUpdatedAt, actorId)
}

export async function deleteEvent(
  id: string,
  expectedUpdatedAt?: string,
  actorId?: string | null,
) {
  // Fetch slug before delete for path revalidation
  let slug: string | null = null
  try {
    const existing = await runFindEventById(id)
    slug = existing?.slug ?? null
  } catch (_err) {
    void _err
  }
  const result = await runDeleteEvent(id, expectedUpdatedAt, actorId)
  revalidateEventCaches(id, slug)
  return result
}
