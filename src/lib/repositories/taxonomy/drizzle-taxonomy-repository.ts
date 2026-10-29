import { arrayOverlaps, asc, eq } from "drizzle-orm"
import { type drizzle } from "drizzle-orm/postgres-js"
import {
  eventCategories,
  sportDisciplines,
  spots,
  spotTypes,
} from "@/db/schema"
import type {
  TaxonomyEntry,
  TaxonomyPatch,
  TaxonomyRepository,
  TrickCatalogEntry,
  TrickMutationOptions,
} from "./taxonomy-repository"
import {
  deleteCanonicalTrick,
  listCurrentTrickCatalogs,
  saveCanonicalTrick,
} from "./trick-catalog-store"

type Db = ReturnType<typeof drizzle>

function normalizePatch(patch: TaxonomyPatch) {
  return {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: Math.trunc(patch.sortOrder) } : {}),
  }
}

function entry(row: { slug: string; name: string; sortOrder: number }): TaxonomyEntry {
  return { slug: row.slug, name: row.name, sortOrder: row.sortOrder }
}

export class DrizzleTaxonomyRepository implements TaxonomyRepository {
  constructor(private readonly db: Db) {}

  async listSports() {
    return (await this.db.select().from(sportDisciplines).orderBy(asc(sportDisciplines.sortOrder), asc(sportDisciplines.name))).map(entry)
  }

  async listEventCategories() {
    return (await this.db.select().from(eventCategories).orderBy(asc(eventCategories.sortOrder), asc(eventCategories.name))).map(entry)
  }

  async updateSport(slug: string, patch: TaxonomyPatch) {
    const [row] = await this.db.update(sportDisciplines).set({ ...normalizePatch(patch) }).where(eq(sportDisciplines.slug, slug)).returning()
    if (!row) throw new Error(`Sport not found: ${slug}`)
    return entry(row)
  }

  async deleteSport(slug: string) {
    const [existing] = await this.db
      .select({ slug: sportDisciplines.slug, name: sportDisciplines.name })
      .from(sportDisciplines)
      .where(eq(sportDisciplines.slug, slug))
      .limit(1)
    if (!existing) throw new Error(`Sport not found: ${slug}`)

    const [spotInUse] = await this.db
      .select({ id: spots.id })
      .from(spots)
      .where(arrayOverlaps(spots.sports, [existing.name, existing.slug]))
      .limit(1)
    if (spotInUse) {
      throw new Error(`Sport is still in use: ${slug}`)
    }

    try {
      const result = await this.db.delete(sportDisciplines).where(eq(sportDisciplines.slug, slug)).returning({ slug: sportDisciplines.slug })
      if (result.length === 0) throw new Error(`Sport not found: ${slug}`)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Sport not found")) throw error
      const wrapped = new Error(`Sport is still in use: ${slug}`)
      ;(wrapped as Error & { cause?: unknown }).cause = error
      throw wrapped
    }
  }

  async listSpotTypes() {
    return (await this.db.select().from(spotTypes).orderBy(asc(spotTypes.sortOrder), asc(spotTypes.name))).map(entry)
  }

  async createSpotType(input: TaxonomyEntry) {
    const [row] = await this.db.insert(spotTypes).values({ slug: input.slug, name: input.name, sortOrder: input.sortOrder }).returning()
    if (!row) throw new Error("Spot type could not be created")
    return entry(row)
  }

  async updateSpotType(slug: string, patch: TaxonomyPatch) {
    const [row] = await this.db.update(spotTypes).set({ ...normalizePatch(patch) }).where(eq(spotTypes.slug, slug)).returning()
    if (!row) throw new Error(`Spot type not found: ${slug}`)
    return entry(row)
  }

  async deleteSpotType(slug: string) {
    try {
      const result = await this.db.delete(spotTypes).where(eq(spotTypes.slug, slug)).returning({ slug: spotTypes.slug })
      if (result.length === 0) throw new Error(`Spot type not found: ${slug}`)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Spot type not found")) throw error
      const wrapped = new Error(`Spot type is still in use: ${slug}`)
      ;(wrapped as Error & { cause?: unknown }).cause = error
      throw wrapped
    }
  }

  async listCurrentTrickCatalogs() {
    return listCurrentTrickCatalogs(this.db)
  }

  async saveTrick(
    disciplineSlug: string,
    trick: TrickCatalogEntry,
    options?: TrickMutationOptions,
  ) {
    return options
      ? saveCanonicalTrick(this.db, disciplineSlug, trick, options)
      : saveCanonicalTrick(this.db, disciplineSlug, trick)
  }

  async deleteTrick(
    disciplineSlug: string,
    sourceId: string,
    options?: TrickMutationOptions,
  ) {
    return options
      ? deleteCanonicalTrick(this.db, disciplineSlug, sourceId, options)
      : deleteCanonicalTrick(this.db, disciplineSlug, sourceId)
  }
}
