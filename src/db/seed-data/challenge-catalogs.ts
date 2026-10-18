// Imports the trick definitions from their JSON fixtures. The fixtures seed
// the mutable administrative model; immutable game snapshots are seeded once
// and created again only when a game needs a changed catalog.

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { type getDbClient } from "@/lib/db/client"
import {
  replaceCanonicalTricks,
  ensureCurrentTrickCatalogSnapshot,
} from "@/lib/repositories/taxonomy/trick-catalog-store"
import { GAME_DEFINITIONS } from "@/lib/games/definitions"
import { log } from "@/lib/utils/log"
import { trickCatalogSchema, type DisciplineSlug, type TrickCatalog } from "@/lib/schemas/game"

type Db = ReturnType<typeof getDbClient>["db"]

const DISCIPLINE_SLUGS = Object.keys(GAME_DEFINITIONS) as DisciplineSlug[]

export function parseDisciplineSlug(input: string | undefined): DisciplineSlug | null {
  const normalized = input?.trim().toLowerCase()
  return DISCIPLINE_SLUGS.find((slug) => slug === normalized) ?? null
}

export function canonicalCatalogSha256(raw: unknown): string {
  const parsed = trickCatalogSchema.parse(raw)
  const { version: _version, ...canonical } = parsed
  const tricks = [...canonical.tricks]
    .map((trick) => ({
      ...trick,
      compatibleSpotTypes: [...trick.compatibleSpotTypes].sort(),
      categories: [...(trick.categories ?? [])].sort(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
  return createHash("sha256")
    .update(JSON.stringify({ ...canonical, tricks }))
    .digest("hex")
}

export function loadCatalog(discipline: DisciplineSlug): TrickCatalog {
  const definition = GAME_DEFINITIONS[discipline]
  const catalog = trickCatalogSchema.parse(
    JSON.parse(readFileSync(definition.catalogPath, "utf8")),
  )
  if (catalog.discipline !== discipline) {
    throw new Error(`Catalog ${discipline} declares discipline ${catalog.discipline}`)
  }
  const ids = new Set<string>()
  for (const trick of catalog.tricks) {
    if (ids.has(trick.id)) throw new Error(`Catalog ${discipline} contains duplicate trick id ${trick.id}`)
    ids.add(trick.id)
  }
  return catalog
}

export async function seedChallengeCatalogForDiscipline(
  db: Db,
  discipline: DisciplineSlug,
): Promise<{ catalogId: string; trickCount: number }> {
  const catalog = loadCatalog(discipline)
  await replaceCanonicalTricks(
    db,
    discipline,
    catalog.tricks.map((trick) => ({
      sourceId: trick.id,
      name: trick.name,
      description: trick.description,
      level: trick.level,
      compatibleSpotTypes: trick.compatibleSpotTypes,
      categories: [...(trick.categories ?? [])],
    })),
  )
  const catalogId = await db.transaction((tx) =>
    ensureCurrentTrickCatalogSnapshot(tx, discipline),
  )
  log.info("seed.challenge_catalogs.done", {
    discipline,
    catalogId,
    trickCount: catalog.tricks.length,
  })
  return { catalogId, trickCount: catalog.tricks.length }
}

export async function seedChallengeCatalogs(db: Db): Promise<void> {
  log.info("seed.challenge_catalogs.start")
  for (const discipline of DISCIPLINE_SLUGS) {
    await seedChallengeCatalogForDiscipline(db, discipline)
  }
}
