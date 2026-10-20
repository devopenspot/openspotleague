import { inArray, sql } from "drizzle-orm"
import type { getDbClient } from "@/lib/db/client"
import {
  spotDisciplines,
  spotImages,
  spotTypeAssignments,
  spots,
} from "@/db/schema"
import {
  SPORT_DISCIPLINE_SEED,
  SPOT_TYPE_SEED,
} from "./taxonomy"
import {
  loadContentSources,
  type NormalizedSpot,
} from "./content"
import { extractStoragePath } from "@/lib/storage/variants"

type Db = ReturnType<typeof getDbClient>["db"]

const SPOT_TYPE_NAME_BY_SLUG = new Map(
  SPOT_TYPE_SEED.map((entry) => [entry.slug, entry.name] as const),
)
const SPORT_NAME_BY_SLUG = new Map(
  SPORT_DISCIPLINE_SEED.map((entry) => [entry.slug, entry.name] as const),
)

function isPlaceholderUrl(url: string): boolean {
  return url.includes("placeholder.local")
}

export interface MigrateSpotsOptions {
  limit?: number
  chunkSize?: number
  upsert?: boolean
  onProgress?: (progress: { phase: string; completed: number; total: number }) => void
}

export interface MigrateSpotsResult {
  spots: number
  images: number
  disciplines: number
  typeAssignments: number
  durationMs: number
}

export interface ValidateSpotsResult {
  ok: boolean
  totalSpots: number
  withImages: number
  totalImages: number
  uniqueCountries: number
  byCountry: Record<string, number>
  byType: Record<string, number>
  byDiscipline: Record<string, number>
  bounds: {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  }
}

/**
 * Validates the canonical spots dataset from src/data/spots.json offline without requiring a database.
 */
export function validateSpots(options: { limit?: number } = {}): ValidateSpotsResult {
  const content = loadContentSources()
  const rawSpots =
    options.limit && options.limit > 0
      ? content.spots.slice(0, options.limit)
      : content.spots

  const byCountry: Record<string, number> = {}
  const byType: Record<string, number> = {}
  const byDiscipline: Record<string, number> = {}
  let totalImages = 0
  let withImages = 0

  let minLat = 90
  let maxLat = -90
  let minLon = 180
  let maxLon = -180

  for (const spot of rawSpots) {
    byCountry[spot.countryCode] = (byCountry[spot.countryCode] ?? 0) + 1

    const rawUrls = spot.images.length > 0 ? spot.images : (spot.imageUrl ? [spot.imageUrl] : [])
    const nonPlaceholderImages = rawUrls.filter((url) => !isPlaceholderUrl(url))
    if (nonPlaceholderImages.length > 0) {
      withImages += 1
      totalImages += nonPlaceholderImages.length
    }

    minLat = Math.min(minLat, spot.location.lat)
    maxLat = Math.max(maxLat, spot.location.lat)
    minLon = Math.min(minLon, spot.location.lon)
    maxLon = Math.max(maxLon, spot.location.lon)

    for (const discipline of spot.sports) {
      byDiscipline[discipline] = (byDiscipline[discipline] ?? 0) + 1
    }

    for (const type of spot.types) {
      byType[type.slug] = (byType[type.slug] ?? 0) + 1
    }
  }

  return {
    ok: true,
    totalSpots: rawSpots.length,
    withImages,
    totalImages,
    uniqueCountries: Object.keys(byCountry).length,
    byCountry,
    byType,
    byDiscipline,
    bounds: {
      minLat: Math.round(minLat * 10000) / 10000,
      maxLat: Math.round(maxLat * 10000) / 10000,
      minLon: Math.round(minLon * 10000) / 10000,
      maxLon: Math.round(maxLon * 10000) / 10000,
    },
  }
}

/**
 * Migrates spots from src/data/spots.json into the target PostgreSQL database.
 */
export async function migrateSpots(
  db: Db,
  options: MigrateSpotsOptions = {},
): Promise<MigrateSpotsResult> {
  const startTime = Date.now()
  const content = loadContentSources()
  const spotsToMigrate: readonly NormalizedSpot[] =
    options.limit && options.limit > 0
      ? content.spots.slice(0, options.limit)
      : content.spots

  const targetSpotIds = new Set(spotsToMigrate.map((spot) => spot.id))
  const relevantAssignments = content.spotTypeAssignments.filter((assignment) =>
    targetSpotIds.has(assignment.spotId),
  )

  const typesBySpot = new Map<string, { name: string; slug: string }[]>()
  for (const assignment of relevantAssignments) {
    const name = SPOT_TYPE_NAME_BY_SLUG.get(assignment.typeSlug)
    if (!name) throw new Error(`Missing spot type seed for ${assignment.typeSlug}`)
    const list = typesBySpot.get(assignment.spotId)
    if (list) list.push({ name, slug: assignment.typeSlug })
    else typesBySpot.set(assignment.spotId, [{ name, slug: assignment.typeSlug }])
  }

  const SPOT_CHUNK = options.chunkSize ?? 500
  let insertedImagesCount = 0
  let insertedDisciplinesCount = 0
  let insertedAssignmentsCount = 0

  await db.transaction(async (tx) => {
    // Elevate statement_timeout for bulk data migration (default API timeout is 8s)
    await tx.execute(sql`set local statement_timeout = '300s'`)

    // 1. Retire stale seed spots with legacy slug formats if they conflict
    const migratedPairs = new Set(
      spotsToMigrate.map((spot) => {
        const tail = `-${spot.id.slice(0, 8)}`
        const base = spot.slug.endsWith(tail)
          ? spot.slug.slice(0, spot.slug.length - tail.length)
          : spot.slug
        return `${base}|${spot.citySlug}`
      }),
    )

    const existing = await tx
      .select({
        id: spots.id,
        slug: spots.slug,
        citySlug: spots.citySlug,
        origin: spots.origin,
        createdBy: spots.createdBy,
      })
      .from(spots)

    const retireIds = existing
      .filter(
        (row) =>
          row.origin === "seed" &&
          row.createdBy === null &&
          !/-[0-9a-f]{8}$/.test(row.slug) &&
          migratedPairs.has(`${row.slug}|${row.citySlug}`),
      )
      .map((row) => row.id)

    for (let i = 0; i < retireIds.length; i += 1000) {
      await tx.delete(spots).where(inArray(spots.id, retireIds.slice(i, i + 1000)))
    }

    // 2. Insert Spots
    const spotRows = spotsToMigrate.map((spot) => ({
      id: spot.id,
      slug: spot.slug,
      name: spot.name,
      city: spot.city,
      citySlug: spot.citySlug,
      address: spot.address,
      imageUrl: spot.imageUrl,
      countryCode: spot.countryCode,
      instagram: spot.instagram,
      verificationCount: 0,
      types: typesBySpot.get(spot.id) ?? [],
      sports: spot.sports.map((slug) => {
        const name = SPORT_NAME_BY_SLUG.get(slug)
        if (!name) throw new Error(`Missing sport discipline seed for ${slug}`)
        return name
      }),
      location: spot.location,
      createdBy: null,
      ...(spot.createdAt ? { createdAt: spot.createdAt } : {}),
      ...(spot.updatedAt ? { updatedAt: spot.updatedAt } : {}),
    }))

    for (let i = 0; i < spotRows.length; i += SPOT_CHUNK) {
      const chunk = spotRows.slice(i, i + SPOT_CHUNK)
      if (options.upsert) {
        await tx
          .insert(spots)
          .values(chunk)
          .onConflictDoUpdate({
            target: spots.id,
            set: {
              slug: sql`excluded.slug`,
              name: sql`excluded.name`,
              city: sql`excluded.city`,
              citySlug: sql`excluded.city_slug`,
              address: sql`excluded.address`,
              imageUrl: sql`excluded.image_url`,
              countryCode: sql`excluded.country_code`,
              instagram: sql`excluded.instagram`,
              types: sql`excluded.types`,
              sports: sql`excluded.sports`,
              location: sql`excluded.location`,
              updatedAt: sql`coalesce(excluded.updated_at, now())`,
            },
          })
      } else {
        await tx.insert(spots).values(chunk).onConflictDoNothing()
      }
      options.onProgress?.({
        phase: "spots",
        completed: Math.min(i + SPOT_CHUNK, spotRows.length),
        total: spotRows.length,
      })
    }

    // 3. Insert Spot Images
    const imageRows = spotsToMigrate.flatMap((spot) => {
      const urls = spot.images.length > 0 ? spot.images : (spot.imageUrl ? [spot.imageUrl] : [])
      return urls
        .filter((url) => !isPlaceholderUrl(url))
        .map((url, sortOrder) => ({ spotId: spot.id, url, sortOrder }))
    })

    insertedImagesCount = imageRows.length
    const IMAGE_CHUNK = SPOT_CHUNK
    for (let i = 0; i < imageRows.length; i += IMAGE_CHUNK) {
      const chunk: { spotId: string; path: string; sortOrder: number }[] = []
      const slice = imageRows.slice(i, i + IMAGE_CHUNK)
      for (const row of slice) {
        const path = extractStoragePath(row.url)
        if (!path || !path.startsWith("spots/")) {
          throw new Error(`Cannot derive storage path for spot image ${row.spotId}: ${row.url}`)
        }
        chunk.push({ spotId: row.spotId, path, sortOrder: row.sortOrder })
      }
      if (chunk.length > 0) {
        await tx.insert(spotImages).values(chunk).onConflictDoNothing()
      }
      options.onProgress?.({
        phase: "images",
        completed: Math.min(i + IMAGE_CHUNK, imageRows.length),
        total: imageRows.length,
      })
    }

    // 4. Insert Spot Disciplines
    const DISCIPLINE_CHUNK = SPOT_CHUNK * 4
    const disciplineRows = spotsToMigrate.flatMap((spot) =>
      spot.sports.map((disciplineSlug) => ({ spotId: spot.id, disciplineSlug })),
    )
    insertedDisciplinesCount = disciplineRows.length

    for (let i = 0; i < disciplineRows.length; i += DISCIPLINE_CHUNK) {
      const chunk = disciplineRows.slice(i, i + DISCIPLINE_CHUNK)
      await tx.insert(spotDisciplines).values(chunk).onConflictDoNothing()
      options.onProgress?.({
        phase: "disciplines",
        completed: Math.min(i + DISCIPLINE_CHUNK, disciplineRows.length),
        total: disciplineRows.length,
      })
    }

    // 5. Insert Spot Type Assignments
    const ASSIGNMENT_CHUNK = SPOT_CHUNK * 4
    const assignmentRows = relevantAssignments.map((assignment) => ({
      spotId: assignment.spotId,
      typeSlug: assignment.typeSlug,
    }))
    insertedAssignmentsCount = assignmentRows.length

    for (let i = 0; i < assignmentRows.length; i += ASSIGNMENT_CHUNK) {
      const chunk = assignmentRows.slice(i, i + ASSIGNMENT_CHUNK)
      await tx.insert(spotTypeAssignments).values(chunk).onConflictDoNothing()
      options.onProgress?.({
        phase: "type_assignments",
        completed: Math.min(i + ASSIGNMENT_CHUNK, assignmentRows.length),
        total: assignmentRows.length,
      })
    }
  })

  // Refresh query planner statistics after bulk insertion of ~177,000 rows
  await db.execute(sql`analyze spots, spot_disciplines, spot_type_assignments, spot_images`).catch(() => undefined)

  return {
    spots: spotsToMigrate.length,
    images: insertedImagesCount,
    disciplines: insertedDisciplinesCount,
    typeAssignments: insertedAssignmentsCount,
    durationMs: Date.now() - startTime,
  }
}
