import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm"
import { type drizzle } from "drizzle-orm/postgres-js"
import {
  countries,
  eventCategories,
  eventDisciplines,
  regions,
  sportDisciplines,
  sportEvents,
  type NewSportEventRow,
} from "@/db/schema"
import type {
  SportEvent,
  SportEventCategory,
  SportDiscipline,
} from "@/types/sport-events"
import type {
  SportEventListResult,
  SportEventQuery,
} from "./event-repository"
import type { EventShuffleFilters } from "../core/types"
import type { EventRepository } from "./event-repository"
import type {
  NewSportEvent,
  SportEventPatch,
  SportEventFacetCountry,
  SportEventFacetDiscipline,
  SportEventFacetCategory,
} from "../core/types"
import { decodeEventCursor, encodeEventCursor } from "./event-pagination"
import {
  assertValidEventDateRange,
  normalizeCitySlug,
} from "@/lib/sport-events/validation"
import {
  InvalidReferenceError,
  StaleRecordError,
} from "../core/errors"
import { deleteWithOccAudit } from "../core/occ-delete"
import { recordContentAudit, toAuditJson } from "../admin/content-audit"
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
  origin: string
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

function toEvent(row: JoinedEventRow): SportEvent {
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
    category: row.category as SportEventCategory,
    categoryName: row.categoryName,
    origin: row.origin as SportEvent["origin"],
    visibility: row.visibility as SportEvent["visibility"],
    lifecycleStatus: row.status as SportEvent["lifecycleStatus"],
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
): Promise<SportEvent[]> {
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
): Promise<SportEvent[]> {
  const { withEventDetailImageUrls } = await import("@/lib/storage")
  const { extractStoragePath } = await import("@/lib/storage/variants")
  return withEventDetailImageUrls(
    rows.map((row) => ({ event: toEvent(row), imagePath: extractStoragePath(row.imageUrl) })),
  )
}

function sportDisciplineTitleToSlug(title: string): string {
  return title.toLowerCase()
}

function dateAtUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
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
        origin: sportEvents.origin,
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
  async listByIds(ids: readonly string[]): Promise<SportEvent[]> {
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
  }): Promise<readonly SportEvent[]> {
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

  async count(): Promise<number> {
    const [row] = await this.db.select({ c: sql<number>`count(*)::int` }).from(sportEvents)
    return Number(row?.c ?? 0)
  }

  async findById(id: string): Promise<SportEvent | null> {
    const rows = await this.selectJoined()
      .where(eq(sportEvents.id, id))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    const [event] = await resolveDetailImageUrls([row])
    return event ?? null
  }

  async findMediaState(id: string): Promise<{ imagePath: string | null } | null> {
    const [row] = await this.db
      .select({ imageUrl: sportEvents.imageUrl })
      .from(sportEvents)
      .where(eq(sportEvents.id, id))
      .limit(1)
    if (!row) return null
    const { extractStoragePath } = await import("@/lib/storage/variants")
    return { imagePath: extractStoragePath(row.imageUrl) }
  }

  async findFeatured(): Promise<SportEvent | null> {
    // Single query: featured events first (true before false), then earliest
    // start. Matches prior two-query fallback but in one round-trip and with
    // deterministic ordering for the featured case (previously unordered).
    const rows = await this.selectJoined()
      .orderBy(desc(sportEvents.featured), asc(sportEvents.startAt))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    const [event] = await resolveDetailImageUrls([row])
    return event ?? null
  }

  async listCountries(): Promise<readonly SportEventFacetCountry[]> {
    const rows = await this.db.execute<{ country: string; count: string }>(sql`
      select c.name as country, count(*)::int as count
      from ${sportEvents} se
      join ${countries} c on c.iso2 = se.country_code
      group by c.name
      order by c.name
    `)
    return rows.map((r) => ({ name: r.country, count: Number(r.count) }))
  }

  async listCategories(): Promise<readonly SportEventFacetCategory[]> {
    const rows = await this.db.execute<{ category: string; count: string }>(sql`
      select ec.slug as category, count(*)::int as count
      from ${sportEvents} se
      join ${eventCategories} ec on ec.slug = se.category_slug
      group by ec.slug
      order by ec.slug
    `)
    return rows.map((r) => ({
      name: r.category as SportEventCategory,
      count: Number(r.count),
    }))
  }

  async listDisciplines(): Promise<readonly SportEventFacetDiscipline[]> {
    const rows = await this.db.execute<{ name: string; count: string }>(sql`
      select sd.name, count(*)::int as count
       from ${eventDisciplines} es
      join ${sportDisciplines} sd on sd.slug = es.discipline_slug
      group by sd.name
      order by sd.name
    `)
    return rows.map((r) => ({
      name: r.name as SportDiscipline,
      count: Number(r.count),
    }))
  }

  private async syncEventDisciplines(
    eventId: string,
    disciplines: readonly SportDiscipline[],
  ): Promise<void> {
    await this.db
      .delete(eventDisciplines)
      .where(eq(eventDisciplines.eventId, eventId))
    if (disciplines.length === 0) return
    const slugs = Array.from(
      new Set(disciplines.map(sportDisciplineTitleToSlug)),
    )
    await this.db
      .insert(eventDisciplines)
      .values(
        slugs.map((disciplineSlug) => ({ eventId, disciplineSlug })),
      )
  }

  private async assertReferenceIntegrity(
    countryCode: string,
    categorySlug: string,
    disciplines: readonly SportDiscipline[],
    requireDiscipline = false,
  ): Promise<void> {
    const [country] = await this.db
      .select({ iso2: countries.iso2 })
      .from(countries)
      .where(eq(countries.iso2, countryCode))
      .limit(1)
    if (!country) {
      throw new InvalidReferenceError(`Country not found: ${countryCode}`)
    }

    const [category] = await this.db
      .select({ slug: eventCategories.slug })
      .from(eventCategories)
      .where(eq(eventCategories.slug, categorySlug))
      .limit(1)
    if (!category) {
      throw new InvalidReferenceError(`Event category not found: ${categorySlug}`)
    }

    const disciplineSlugs = Array.from(
      new Set(disciplines.map(sportDisciplineTitleToSlug)),
    )
    if (requireDiscipline && disciplineSlugs.length === 0) {
      throw new InvalidReferenceError("A sport event must have at least one sport discipline")
    }
    if (disciplineSlugs.length === 0) return
    const rows = await this.db
      .select({ slug: sportDisciplines.slug })
      .from(sportDisciplines)
      .where(inArray(sportDisciplines.slug, disciplineSlugs))
    const found = new Set(rows.map((row) => row.slug))
    const missing = disciplineSlugs.filter((slug) => !found.has(slug))
    if (missing.length > 0) {
      throw new InvalidReferenceError(
        `Sport discipline not found: ${missing.join(", ")}`,
      )
    }
  }

  /**
   * Builds the `insertValues` for a sport event from a `NewSportEvent`
   * input. The slug defaults to `<normalized-name>-<timestamp>` (each
   * call gets a unique slug, used by the user-facing create flow);
   * pass `input.slug` to pin it (used by the seed, which needs a
   * stable upsert key across re-seeds). `citySlug` defaults to a
   * slugified version of `city` when absent.
   */
  private async buildInsertValues(input: NewSportEvent): Promise<NewSportEventRow> {
    const id = (input as { id?: string }).id ?? crypto.randomUUID()
    const slug = input.slug ?? `${normalizeCitySlug(input.name)}-${Date.now()}`
    assertValidEventDateRange(input.startDate, input.endDate)
    const countryCode = input.countryCode
      ? input.countryCode
      : (await this.db
          .select({ iso2: countries.iso2 })
          .from(countries)
          .where(eq(countries.name, input.country))
          .limit(1))[0]?.iso2
    if (!countryCode) {
      throw new InvalidReferenceError(`Country not found: ${input.country}`)
    }
    const location =
      typeof input.latitude === "number" && typeof input.longitude === "number"
        ? { lat: input.latitude, lon: input.longitude }
        : null
    const citySlug = input.citySlug ?? normalizeCitySlug(input.city)
    const endAt = input.endDate ? dateAtUtc(input.endDate) : null

    return {
      id,
      slug,
      name: input.name,
      shortName: input.shortName ?? null,
      url: input.url ?? null,
      imageUrl: input.image,
      description: input.description,
      origin: input.origin ?? "seed",
      visibility: input.visibility ?? "public",
      status: input.status ?? (endAt && endAt.getTime() < Date.now() ? "completed" : "scheduled"),
      timezone: input.timezone ?? "UTC",
      planSlug: "free",
      startAt: dateAtUtc(input.startDate),
      endAt,
      city: input.city,
      citySlug,
      address: input.address ?? null,
      countryCode,
      venue: input.venue ?? null,
      location,
      featured: input.featured,
      instagram: input.instagram ?? null,
      youtube: input.youtube ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    }
  }

  /**
   * Inserts (or updates on slug conflict) the event row, then syncs
   * the sport-join table. Returns the row's real `id`. Shared by
   * `create` (which then reloads) and `upsertBySlug` (which returns
   * the id without reloading).
   */
  private async upsertAndSync(
    input: NewSportEvent,
    insertValues: NewSportEventRow,
  ): Promise<string> {
    await this.assertReferenceIntegrity(
      insertValues.countryCode,
      insertValues.categorySlug ?? "local-event",
      input.sports,
      true,
    )
    const [row] = await this.db
      .insert(sportEvents)
      .values(insertValues)
      .onConflictDoUpdate({
        target: sportEvents.slug,
        set: {
          name: insertValues.name,
          shortName: insertValues.shortName,
          url: insertValues.url,
          imageUrl: insertValues.imageUrl,
          description: insertValues.description,
          startAt: insertValues.startAt,
          endAt: insertValues.endAt,
          city: insertValues.city,
          citySlug: insertValues.citySlug,
          address: insertValues.address,
          countryCode: insertValues.countryCode,
          venue: insertValues.venue,
          location: insertValues.location,
          categorySlug: insertValues.categorySlug,
          featured: insertValues.featured,
          instagram: insertValues.instagram,
          youtube: insertValues.youtube,
          // Lifecycle/ownership columns (origin, status, timezone, plan,
          // version) and the creator are never transferred by a re-seed
          // upsert.
          createdBy: sql`${sportEvents.createdBy}`,
          updatedBy: sql`${sportEvents.updatedBy}`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: sportEvents.id })
    const rowId = row?.id
    if (!rowId) throw new Error("Insert returned no row")
    await this.syncEventDisciplines(rowId, input.sports)
    return rowId
  }

  private async auditSnapshot(id: string): Promise<Record<string, unknown> | null> {
    const [row] = await this.db
      .select()
      .from(sportEvents)
      .where(eq(sportEvents.id, id))
      .limit(1)
    if (!row) return null
    const disciplines = await this.db
      .select({ slug: eventDisciplines.disciplineSlug })
      .from(eventDisciplines)
      .where(eq(eventDisciplines.eventId, id))
    return toAuditJson({
      ...row,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt?.toISOString() ?? null,
      registrationClosesAt: row.registrationClosesAt?.toISOString() ?? null,
      schedulePublishedAt: row.schedulePublishedAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      resultsPublishedAt: row.resultsPublishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sports: disciplines.map((discipline) => discipline.slug),
    }) as Record<string, unknown>
  }

  async create(input: NewSportEvent): Promise<SportEvent> {
    const insertValues = await this.buildInsertValues(input)
    const [existing] = await this.db
      .select({ id: sportEvents.id })
      .from(sportEvents)
      .where(eq(sportEvents.slug, insertValues.slug))
      .limit(1)
    const before = existing ? await this.auditSnapshot(existing.id) : null
    const rowId = await this.upsertAndSync(input, insertValues)
    const after = await this.auditSnapshot(rowId)
    await recordContentAudit(this.db, {
      actorId: input.createdBy ?? null,
      entityType: "event",
      entityId: rowId,
      action: before ? "update" : "create",
      before,
      after,
      disciplineSlug: input.sports.length === 1
        ? sportDisciplineTitleToSlug(input.sports[0]!)
        : null,
    })
    const reloaded = await this.findById(rowId)
    if (!reloaded) throw new Error("Event not found after insert")
    return reloaded
  }

  /**
   * Upsert a sport event by slug and sync its sport-join table.
   * Returns the row id without reloading. Used by the seed.
   */
  async upsertBySlug(input: NewSportEvent): Promise<{ id: string }> {
    if (!input.slug) {
      throw new Error("upsertBySlug requires input.slug")
    }
    const insertValues = await this.buildInsertValues(input)
    const id = await this.upsertAndSync(input, insertValues)
    return { id }
  }

  async update(
    id: string,
    patch: SportEventPatch,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<SportEvent> {
    const expectedDate = this.parseExpectedUpdatedAt(expectedUpdatedAt)
    const before = await this.auditSnapshot(id)
    const [current] = await this.db
      .select({ startAt: sportEvents.startAt, endAt: sportEvents.endAt })
      .from(sportEvents)
      .where(eq(sportEvents.id, id))
      .limit(1)
    if (!current) throw new Error(`Sport event not found: ${id}`)

    const [currentMetadata] = await this.db
      .select({
        countryCode: sportEvents.countryCode,
        categorySlug: sportEvents.categorySlug,
        updatedAt: sportEvents.updatedAt,
      })
      .from(sportEvents)
      .where(eq(sportEvents.id, id))
      .limit(1)
    if (!currentMetadata) throw new Error(`Sport event not found: ${id}`)
    // See drizzle-spot-repository: OCC relies on the atomic WHERE clause,
    // not an early getTime() check which is brittle across PG µs vs JS ms.

    const nextStartDate = patch.startDate ?? dateOnly(current.startAt)
    const nextEndDate =
      patch.endDate === undefined
        ? current.endAt
          ? dateOnly(current.endAt)
          : undefined
        : patch.endDate ?? undefined
    assertValidEventDateRange(nextStartDate, nextEndDate)

    const setValues: Partial<NewSportEventRow> = {
      updatedAt: new Date(),
      // Content edits advance the OCC counter so realtime clients see a
      // fresh version after any mutation.
      version: sql`${sportEvents.version} + 1` as unknown as number,
    }
    if (patch.name !== undefined) setValues.name = patch.name
    if (patch.shortName !== undefined) setValues.shortName = patch.shortName
    if (patch.url !== undefined) setValues.url = patch.url
    if (patch.image !== undefined) setValues.imageUrl = patch.image
    // imagePath is obsolete — derived from imageUrl
    if (patch.description !== undefined) setValues.description = patch.description
    if (patch.startDate !== undefined) {
      // Build the full timestamp string first, then bind as a single
      // parameter and cast to timestamptz. Mirrors `buildInsertValues`
      // (the create / upsertAndSync path) so both writes produce
      // identical SQL — earlier the literal ` 00:00:00+00::timestamptz`
      // sat *after* the parameter, producing an unparseable statement
      // (`$6 00:00:00+00::timestamptz`) and every PATCH returned 500.
      setValues.startAt = dateAtUtc(patch.startDate)
    }
    if (patch.endDate !== undefined) {
      if (patch.endDate === null || patch.endDate === "") {
        setValues.endAt = null
      } else {
        setValues.endAt = dateAtUtc(patch.endDate)
      }
    }
    if (patch.city !== undefined) {
      setValues.city = patch.city
      if (patch.citySlug === undefined) {
        setValues.citySlug = normalizeCitySlug(patch.city)
      }
    }
    if (patch.citySlug !== undefined) setValues.citySlug = patch.citySlug
    if (patch.address !== undefined) setValues.address = patch.address
    let countryCode = currentMetadata.countryCode
    if (patch.countryCode !== undefined) {
      setValues.countryCode = patch.countryCode
      countryCode = patch.countryCode
    } else if (patch.country !== undefined) {
      const [country] = await this.db
        .select({ iso2: countries.iso2 })
        .from(countries)
        .where(eq(countries.name, patch.country))
        .limit(1)
      if (!country) {
        throw new InvalidReferenceError(`Country not found: ${patch.country}`)
      }
      setValues.countryCode = country.iso2
      countryCode = country.iso2
    }
    if (patch.venue !== undefined) setValues.venue = patch.venue
    let categorySlug = currentMetadata.categorySlug
    if (patch.category !== undefined) {
      setValues.categorySlug = patch.category
      categorySlug = patch.category
    }
    if (patch.visibility !== undefined) setValues.visibility = patch.visibility
    if (patch.status !== undefined) setValues.status = patch.status
    if (patch.timezone !== undefined) setValues.timezone = patch.timezone
    if (patch.featured !== undefined) {
      setValues.featured = patch.featured
    }
    if (patch.instagram !== undefined) setValues.instagram = patch.instagram
    if (patch.youtube !== undefined) setValues.youtube = patch.youtube
    if (patch.latitude !== undefined && patch.longitude !== undefined) {
      setValues.location = {
        lat: patch.latitude,
        lon: patch.longitude,
      }
    }

    const currentDisciplines = await this.db
      .select({ slug: eventDisciplines.disciplineSlug })
      .from(eventDisciplines)
      .where(eq(eventDisciplines.eventId, id))
    const nextDisciplines = patch.sports ?? currentDisciplines.map(
      (discipline) => discipline.slug as SportDiscipline,
    )
    await this.assertReferenceIntegrity(
      countryCode,
      categorySlug,
      nextDisciplines,
      true,
    )
    if (actorId !== undefined) setValues.updatedBy = actorId

    const where = expectedDate
      ? and(eq(sportEvents.id, id), eq(sportEvents.updatedAt, expectedDate))
      : eq(sportEvents.id, id)
    const [row] = await this.db
      .update(sportEvents)
      .set(setValues)
      .where(where)
      .returning()
    if (!row) {
      throw expectedDate
        ? new StaleRecordError()
        : new Error(`Sport event not found: ${id}`)
    }
    if (patch.sports !== undefined) {
      await this.syncEventDisciplines(id, patch.sports)
    }
    const after = await this.auditSnapshot(id)
    await recordContentAudit(this.db, {
      actorId,
      entityType: "event",
      entityId: id,
      action: "update",
      before,
      after,
      disciplineSlug: patch.sports?.length === 1
        ? sportDisciplineTitleToSlug(patch.sports[0]!)
        : null,
    })
    const reloaded = await this.findById(id)
    if (!reloaded) throw new Error(`Sport event not found: ${id}`)
    return reloaded
  }

  async delete(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<{ imagePath: string | null }> {
    const expectedDate = this.parseExpectedUpdatedAt(expectedUpdatedAt)
    const before = await this.auditSnapshot(id)
    const rawUrl =
      before && typeof (before as Record<string, unknown>).imageUrl === "string"
        ? ((before as Record<string, unknown>).imageUrl as string)
        : (before as Record<string, unknown>).imagePath
          ? ((before as Record<string, unknown>).imagePath as string)
          : null
    const { extractStoragePath: _extract } = await import("@/lib/storage/variants")
    const imagePath = rawUrl ? _extract(rawUrl) : null
    await deleteWithOccAudit({
      db: this.db,
      table: sportEvents,
      id,
      entityType: "event",
      expectedDate,
      actorId,
      before,
      notFoundMessage: `Sport event not found: ${id}`,
    })
    return { imagePath }
  }
}
