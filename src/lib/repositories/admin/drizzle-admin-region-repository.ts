import { asc, count, eq, sql } from "drizzle-orm"
import { type drizzle } from "drizzle-orm/postgres-js"
import { countries, regions, sportEvents, spots } from "@/db/schema"
import { isForeignKeyViolation } from "../core/db-error-map"
import type {
  AdminRegion,
  AdminCountry,
  AdminRegionPatch,
  AdminCountryPatch,
  AdminRegionRepository,
} from "./admin-region-repository"

export class DrizzleAdminRegionRepository implements AdminRegionRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async listRegions(): Promise<readonly AdminRegion[]> {
    const regionRows = await this.db
      .select({
        id: regions.id,
        slug: regions.slug,
        name: regions.name,
        description: regions.description,
        imageUrl: regions.imageUrl,
        sortOrder: regions.sortOrder,
        countryCount: sql<number>`count(${countries.iso2})`.mapWith(Number),
      })
      .from(regions)
      .leftJoin(countries, eq(countries.regionId, regions.id))
      .groupBy(regions.id)
      .orderBy(asc(regions.sortOrder), asc(regions.name))

    return regionRows
  }

  async createRegion(input: {
    slug: string
    name: string
    description?: string
    imageUrl?: string | null
    sortOrder?: number
  }): Promise<AdminRegion> {
    const [created] = await this.db
      .insert(regions)
      .values({
        slug: input.slug,
        name: input.name,
        description: input.description ?? "",
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning({
        id: regions.id,
        slug: regions.slug,
        name: regions.name,
        description: regions.description,
        imageUrl: regions.imageUrl,
        sortOrder: regions.sortOrder,
      })

    return { ...created, countryCount: 0 } as AdminRegion
  }

  async updateRegion(id: string, patch: AdminRegionPatch): Promise<AdminRegion> {
    const updateData: Record<string, unknown> = {}
    if (patch.name !== undefined) updateData.name = patch.name
    if (patch.slug !== undefined) updateData.slug = patch.slug
    if (patch.description !== undefined) updateData.description = patch.description
    if (patch.imageUrl !== undefined) updateData.imageUrl = patch.imageUrl
    if (patch.sortOrder !== undefined) updateData.sortOrder = patch.sortOrder
    updateData.updatedAt = new Date()

    const [updated] = await this.db
      .update(regions)
      .set(updateData)
      .where(eq(regions.id, id))
      .returning({
        id: regions.id,
        slug: regions.slug,
        name: regions.name,
        description: regions.description,
        imageUrl: regions.imageUrl,
        sortOrder: regions.sortOrder,
      })

    if (!updated) throw new Error(`Region not found: ${id}`)

    const countryCount = await this.db
      .select({ count: count() })
      .from(countries)
      .where(eq(countries.regionId, id))

    return { ...updated, countryCount: countryCount[0]?.count ?? 0 } as AdminRegion
  }

  async deleteRegion(id: string): Promise<void> {
    try {
      const [deleted] = await this.db.delete(regions).where(eq(regions.id, id)).returning({ id: regions.id })
      if (!deleted) throw new Error(`Region not found: ${id}`)
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        const wrapped = new Error("Cannot delete region with associated countries. Reassign or delete countries first.")
        ;(wrapped as Error & { cause?: unknown }).cause = error
        throw wrapped
      }
      throw error
    }
  }

  async listCountries(): Promise<readonly AdminCountry[]> {
    // Single round-trip: correlated subqueries avoid 2 separate GROUP BY scans
    // and the client-side Map joins. For ~250 countries the per-row index
    // lookups on `spots.country_code` / `sport_events.country_code` are
    // covered by `spots_country_code_idx` / `sport_events_country_code_idx`.
    const rows = await this.db
      .select({
        iso2: countries.iso2,
        name: countries.name,
        iso3: countries.iso3,
        regionId: countries.regionId,
        regionName: regions.name,
        spotCount: sql<number>`(select count(*)::int from ${spots} where ${spots.countryCode} = ${countries.iso2})`.mapWith(
          Number,
        ),
        eventCount: sql<number>`(select count(*)::int from ${sportEvents} where ${sportEvents.countryCode} = ${countries.iso2})`.mapWith(
          Number,
        ),
      })
      .from(countries)
      .innerJoin(regions, eq(regions.id, countries.regionId))
      .orderBy(asc(regions.sortOrder), asc(countries.name))

    return rows.map((row) => ({
      iso2: row.iso2,
      name: row.name,
      iso3: row.iso3,
      regionId: row.regionId,
      regionName: row.regionName,
      spotCount: row.spotCount ?? 0,
      eventCount: row.eventCount ?? 0,
    }))
  }

  async updateCountry(iso2: string, patch: AdminCountryPatch): Promise<AdminCountry> {
    const updateData: Record<string, unknown> = {}
    if (patch.name !== undefined) updateData.name = patch.name
    if (patch.iso3 !== undefined) updateData.iso3 = patch.iso3
    if (patch.regionId !== undefined) updateData.regionId = patch.regionId
    updateData.updatedAt = new Date()

    const [updated] = await this.db
      .update(countries)
      .set(updateData)
      .where(eq(countries.iso2, iso2))
      .returning({
        iso2: countries.iso2,
        name: countries.name,
        iso3: countries.iso3,
        regionId: countries.regionId,
      })

    if (!updated) throw new Error(`Country not found: ${iso2}`)

    const [region] = await this.db
      .select({ name: regions.name })
      .from(regions)
      .where(eq(regions.id, updated.regionId))
      .limit(1)

    const spotCounts = await this.db
      .select({ count: count() })
      .from(spots)
      .where(eq(spots.countryCode, iso2))

    const eventCounts = await this.db
      .select({ count: count() })
      .from(sportEvents)
      .where(eq(sportEvents.countryCode, iso2))

    return {
      iso2: updated.iso2,
      name: updated.name,
      iso3: updated.iso3,
      regionId: updated.regionId,
      regionName: region?.name ?? "",
      spotCount: spotCounts[0]?.count ?? 0,
      eventCount: eventCounts[0]?.count ?? 0,
    }
  }

  async createCountry(input: { iso2: string; name: string; iso3?: string | null; regionId: string }): Promise<AdminCountry> {
    const iso2 = input.iso2.trim().toUpperCase()
    const name = input.name.trim()
    const iso3 = input.iso3?.trim() ? input.iso3.trim().toUpperCase() : null

    const [created] = await this.db
      .insert(countries)
      .values({
        iso2,
        name,
        iso3,
        regionId: input.regionId,
      })
      .returning({
        iso2: countries.iso2,
        name: countries.name,
        iso3: countries.iso3,
        regionId: countries.regionId,
      })

    if (!created) throw new Error("Failed to create country")

    const [region] = await this.db
      .select({ name: regions.name })
      .from(regions)
      .where(eq(regions.id, created.regionId))
      .limit(1)

    return {
      iso2: created.iso2,
      name: created.name,
      iso3: created.iso3,
      regionId: created.regionId,
      regionName: region?.name ?? "",
      spotCount: 0,
      eventCount: 0,
    }
  }

  async deleteCountry(iso2: string): Promise<void> {
    try {
      const [deleted] = await this.db
        .delete(countries)
        .where(eq(countries.iso2, iso2))
        .returning({ iso2: countries.iso2 })
      if (!deleted) throw new Error(`Country not found: ${iso2}`)
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        // Enrich the generic FK violation with current counts for a friendlier message
        // (counts are for messaging only; the DB constraint is the authority).
        const [spotCount] = await this.db
          .select({ count: count() })
          .from(spots)
          .where(eq(spots.countryCode, iso2))
        const [eventCount] = await this.db
          .select({ count: count() })
          .from(sportEvents)
          .where(eq(sportEvents.countryCode, iso2))
        const sc = spotCount?.count ?? 0
        const ec = eventCount?.count ?? 0
        if (sc > 0 || ec > 0) {
          const parts: string[] = []
          if (sc > 0) parts.push(`${sc} spot${sc === 1 ? "" : "s"}`)
          if (ec > 0) parts.push(`${ec} event${ec === 1 ? "" : "s"}`)
          const wrapped = new Error(
            `Cannot delete country with associated ${parts.join(" and ")}. Delete or reassign them first.`,
          )
          ;(wrapped as Error & { cause?: unknown }).cause = error
          throw wrapped
        }
        const generic = new Error("Cannot delete country with associated spots or events. Delete or reassign them first.")
        ;(generic as Error & { cause?: unknown }).cause = error
        throw generic
      }
      throw error
    }
  }
}
