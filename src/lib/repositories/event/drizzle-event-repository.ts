import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm"
import { type drizzle } from "drizzle-orm/postgres-js"
import {
  countries,
  eventCategories,
  eventDisciplines,
  regions,
  sportDisciplines,
  sportEvents,
} from "@/db/schema"
import type { SportDiscipline } from "@/types/disciplines"
import type { Contest, ContestCategory } from "@/types/league"
import type {
  SportEventListResult,
  SportEventQuery,
} from "./event-repository"
import type { EventShuffleFilters } from "../core/types"
import type { EventRepository } from "./event-repository"
import { decodeEventCursor, encodeEventCursor } from "./event-pagination"
import { BaseDrizzleRepository } from "../core/base"

import { EVENT_LIST_HARD_CAP } from "@/lib/config/constants"
const DEFAULT_EVENT_LIST_LIMIT = 50
const MAX_EVENT_LIST_LIMIT = EVENT_LIST_HARD_CAP

const sportsAgg = sql<string[]>`
  coalesce(
    (
      select array_agg(sd.name order by sd.name)
       from ${eventDisciplines} es
      join ${sportDisciplines} sd on sd.slug = es.discipline_slug
      where es.event_id = ${sportEvents.id}
    ),
    '{}'::text[]
  )
`.as("sports")

interface JoinedEventRow {
  id: string
  slug: string
  name: string
  shortName: string | null
  url: string | null
  imageUrl: string
  description: string
  sports: string[]
  category: string
  categoryName: string
  visibility: string
  status: string
  timezone: string
  startAt: Date
  endAt: Date | null
  city: string
  citySlug: string | null
  address: string | null
  country: string
  countryCode: string
  regionName: string | null
  venue: string | null
  location: { lat: number; lon: number } | null
  spotNameSnapshot: string | null
  featured: boolean
  instagram: string | null
  youtube: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

function dateOnly(d: Date | null): string {
  if (!d) return ""
  return d.toISOString().slice(0, 10)
}

function toEvent(row: JoinedEventRow): Contest {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName ?? undefined,
    url: row.url,
    image: row.imageUrl,
    description: row.description,
    sports: row.sports as readonly SportDiscipline[],
    startDate: dateOnly(row.startAt),
    endDate: row.endAt ? dateOnly(row.endAt) : undefined,
    location: {
      city: row.city,
      citySlug: row.citySlug ?? undefined,
      address: row.address ?? undefined,
      country: row.country,
      countryCode: row.countryCode,
      region: row.regionName ?? undefined,
      venue: row.venue ?? undefined,
      latitude: row.location?.lat,
      longitude: row.location?.lon,
    },
    category: row.category as ContestCategory,
    categoryName: row.categoryName,
    visibility: row.visibility as Contest["visibility"],
    lifecycleStatus: row.status as Contest["lifecycleStatus"],
    timezone: row.timezone,
    spotName: row.spotNameSnapshot,
    featured: row.featured,
    instagram: row.instagram,
    youtube: row.youtube,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function resolveImageUrls(
  rows: readonly JoinedEventRow[],
): Promise<Contest[]> {
  // Wire cards render 232px wide × 32vh tall (~660–810 device px on 2×/3×
  // screens) — detail (800) is the smallest variant that stays crisp; the
  // card (400) variant left wire images visibly upscaled next to spot cards.
  const { withEventDetailImageUrls } = await import("@/lib/storage")
  const { extractStoragePath } = await import("@/lib/storage/variants")
  return withEventDetailImageUrls(
    rows.map((row) => ({ event: toEvent(row), imagePath: extractStoragePath(row.imageUrl) })),
  )
}

async function resolveDetailImageUrls(
  rows: readonly JoinedEventRow[],
): Promise<Contest[]> {
  const { withEventDetailImageUrls } = await import("@/lib/storage")
  const { extractStoragePath } = await import("@/lib/storage/variants")
  return withEventDetailImageUrls(
    rows.map((row) => ({ event: toEvent(row), imagePath: extractStoragePath(row.imageUrl) })),
  )
}

export class DrizzleEventRepository extends BaseDrizzleRepository implements EventRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {
    super()
  }

  private selectJoined({ includeSports = true } = {}) {
    return this.db
      .select({
        id: sportEvents.id,
        slug: sportEvents.slug,
        name: sportEvents.name,
        shortName: sportEvents.shortName,
        url: sportEvents.url,
        imageUrl: sportEvents.imageUrl,
        description: sportEvents.description,
        // The map projection does not need sports. Skipping the correlated
        // aggregation keeps its cold-cache query materially smaller.
        sports: includeSports ? sportsAgg : sql<string[]>`'{}'::text[]`,
        category: eventCategories.slug,
        categoryName: eventCategories.name,
        visibility: sportEvents.visibility,
        status: sportEvents.status,
        timezone: sportEvents.timezone,
        startAt: sportEvents.startAt,
        endAt: sportEvents.endAt,
        city: sportEvents.city,
        citySlug: sportEvents.citySlug,
        address: sportEvents.address,
        country: countries.name,
        countryCode: sportEvents.countryCode,
        regionName: regions.name,
        venue: sportEvents.venue,
        location: sportEvents.location,
        spotNameSnapshot: sportEvents.spotNameSnapshot,
        featured: sportEvents.featured,
        instagram: sportEvents.instagram,
        youtube: sportEvents.youtube,
        createdBy: sportEvents.createdBy,
        createdAt: sportEvents.createdAt,
        updatedAt: sportEvents.updatedAt,
      })
      .from(sportEvents)
       .innerJoin(eventCategories, eq(eventCategories.slug, sportEvents.categorySlug))
       .innerJoin(countries, eq(countries.iso2, sportEvents.countryCode))
      .leftJoin(regions, eq(regions.id, countries.regionId))
      .$dynamic()
  }

  /**
   * Filter-only WHERE builder shared by the shuffle ID list. Same
   * predicates as the deterministic path (country/city/category/
   * featured/discipline/date-range/search).
   */
  private shuffleFilterConditions(query: EventShuffleFilters): SQL | undefined {
    const filterConditions: SQL[] = [
      eq(sportEvents.visibility, "public"),
    ]
    if (query.country) filterConditions.push(eq(countries.name, query.country))
    if (query.citySlug) filterConditions.push(eq(sportEvents.citySlug, query.citySlug))
    if (query.category) filterConditions.push(eq(sportEvents.categorySlug, query.category))
    if (query.featured) filterConditions.push(eq(sportEvents.featured, true))
    if (query.discipline) {
      filterConditions.push(
        sql`exists (
           select 1 from ${eventDisciplines} es
          join ${sportDisciplines} sd on sd.slug = es.discipline_slug
          where es.event_id = ${sportEvents.id}
            and lower(sd.name) = ${query.discipline.toLowerCase()}
        )`,
      )
    }
    if (query.from) filterConditions.push(sql`${sportEvents.startAt} >= ${query.from}::timestamptz`)
    if (query.to) filterConditions.push(sql`coalesce(${sportEvents.endAt}, ${sportEvents.startAt}) <= ${query.to}::timestamptz`)
    if (query.q) {
      const like = `%${query.q.toLowerCase()}%`
      filterConditions.push(sql`(
      lower(coalesce(${sportEvents.name}, '')) like ${like}
      or lower(coalesce(${sportEvents.description}, '')) like ${like}
      or lower(coalesce(${sportEvents.city}, '')) like ${like}
      or lower(coalesce(${countries.name}, '')) like ${like}
    )`)
    }
    const whereIds = filterConditions.length > 0 ? and(...(filterConditions.filter(Boolean) as SQL[])) : undefined
    return whereIds
  }

  /**
   * Full filtered ID list for seeded shuffle pagination — IDs only.
   * Cached by filter at the service layer (shared across visitors).
   */
  async listShuffledIds(query: EventShuffleFilters): Promise<string[]> {
    const whereIds = this.shuffleFilterConditions(query)
    // Direct ids fetch — join countries only if needed for country filter already in where
    const idRows = await (whereIds
      ? this.db.select({ id: sportEvents.id }).from(sportEvents).innerJoin(countries, eq(countries.iso2, sportEvents.countryCode)).where(whereIds)
      : this.db.select({ id: sportEvents.id }).from(sportEvents))
    return idRows.map((r) => r.id)
  }

  /**
   * Full joined rows for page IDs, in no guaranteed order — the caller
   * restores shuffle order before returning.
   */
  async listByIds(ids: readonly string[]): Promise<Contest[]> {
    if (ids.length === 0) return []
    const rows = await this.selectJoined().where(
      and(
        eq(sportEvents.visibility, "public"),
        inArray(sportEvents.id, [...ids]),
      ),
    )
    return resolveImageUrls(rows)
  }

  async list(query?: SportEventQuery): Promise<SportEventListResult> {
    // Seeded shuffle pagination lives in the service layer
    // (`runListEventsRandom`): the ID list is cached by filter. Fail
    // fast instead of silently returning deterministic order.
    if (query?.random && query.seed) {
      throw new Error("DrizzleEventRepository.list: random queries must go through runListEventsRandom")
    }
    const limit = this.limitClamp(query?.limit ?? DEFAULT_EVENT_LIST_LIMIT, MAX_EVENT_LIST_LIMIT)
    const conditions: SQL[] = [
      // Directory scope: public events only (community events default to
      // unlisted and surface via links/QR; curators publish explicitly).
      eq(sportEvents.visibility, "public"),
    ]
    const cursor = decodeEventCursor(query?.cursor)
    if (cursor) {
      conditions.push(
        sql`(${sportEvents.startAt}, ${sportEvents.id}) > (${cursor.startAt}::timestamptz, ${cursor.id}::uuid)`,
      )
    }
    if (query?.country)
      conditions.push(eq(countries.name, query.country))
    if (query?.citySlug)
      conditions.push(eq(sportEvents.citySlug, query.citySlug))
    if (query?.category)
      conditions.push(eq(sportEvents.categorySlug, query.category))
    if (query?.featured)
      conditions.push(eq(sportEvents.featured, true))
    if (query?.discipline)
      conditions.push(
        sql`exists (
           select 1 from ${eventDisciplines} es
           join ${sportDisciplines} sd on sd.slug = es.discipline_slug
           where es.event_id = ${sportEvents.id}
             and lower(sd.name) = ${query.discipline.toLowerCase()}
         )`,
      )
    if (query?.from)
      conditions.push(sql`${sportEvents.startAt} >= ${query.from}::timestamptz`)
    if (query?.to)
      conditions.push(
        sql`coalesce(${sportEvents.endAt}, ${sportEvents.startAt}) <= ${query.to}::timestamptz`,
      )
    if (query?.q) {
      const like = `%${query.q.toLowerCase()}%`
      conditions.push(sql`(
        lower(coalesce(${sportEvents.name}, '')) like ${like}
        or lower(coalesce(${sportEvents.description}, '')) like ${like}
        or lower(coalesce(${sportEvents.city}, '')) like ${like}
        or lower(coalesce(${countries.name}, '')) like ${like}
      )`)
    }
    const where =
      conditions.length > 0
        ? and(
            ...conditions
              .map((c) => c as SQL | undefined)
              .filter(Boolean) as SQL[],
          )
        : undefined

    const rows = await (where
      ? this.selectJoined().where(where)
      : this.selectJoined()
    )
      .orderBy(asc(sportEvents.startAt), asc(sportEvents.id))
      .limit(limit + 1)
    const joinedRows = rows
    const pageRows = joinedRows.slice(0, limit)
    const items = await resolveImageUrls(pageRows)
    const hasMore = joinedRows.length > limit
    const nextCursor =
      hasMore && pageRows.length > 0
        ? encodeEventCursor({
            startAt: pageRows[pageRows.length - 1]!.startAt.toISOString(),
            id: pageRows[pageRows.length - 1]!.id,
          })
        : null
    return { items, nextCursor, hasMore }
  }

  async listMap(query?: {
    citySlug?: string
    limit?: number
  }): Promise<readonly Contest[]> {
    const conditions: SQL[] = [
      isNotNull(sportEvents.location),
      eq(sportEvents.visibility, "public"),
    ]
    if (query?.citySlug) {
      conditions.push(eq(sportEvents.citySlug, query.citySlug))
    }

    const rows = await this.selectJoined({ includeSports: false })
      .where(and(...conditions))
      .orderBy(desc(sportEvents.featured), asc(sportEvents.startAt))
      .limit(query?.limit ?? 50)

    // The map projection drops image fields, so do not spend a storage
    // request signing URLs that cannot be rendered by map consumers.
    return rows.map(toEvent)
  }

  async findById(id: string): Promise<Contest | null> {
    const rows = await this.selectJoined()
      .where(eq(sportEvents.id, id))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    const [event] = await resolveDetailImageUrls([row])
    return event ?? null
  }
}
