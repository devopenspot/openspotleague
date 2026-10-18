// Refreshes the trick catalog for all disciplines or a single discipline from JSON fixtures
// (src/data/tricks/<discipline>.json). Same replace + snapshot semantics as
// the full seed: the fixture is the source of truth — tricks missing from it
// are deleted — and no new immutable snapshot is created when content is
// unchanged. Usage:
//   pnpm db:seed-tricks                     (all disciplines)
//   pnpm db:seed-tricks <discipline>        (single discipline)

import "./load-env"
import { sql } from "drizzle-orm"
import { closeDb, getDbClient } from "@/lib/db/client"
import { GAME_DEFINITIONS } from "@/lib/games/definitions"
import { log } from "@/lib/utils/log"
import type { DisciplineSlug } from "@/lib/schemas/game"
import {
  loadCatalog,
  parseDisciplineSlug,
  seedChallengeCatalogForDiscipline,
} from "./seed-data/challenge-catalogs"

const ALL_DISCIPLINES = Object.keys(GAME_DEFINITIONS) as DisciplineSlug[]
const DISCIPLINES_LIST = ALL_DISCIPLINES.join(", ")

async function assertKnownSpotTypes(
  db: ReturnType<typeof getDbClient>["db"],
  discipline: NonNullable<ReturnType<typeof parseDisciplineSlug>>,
): Promise<void> {
  const catalog = loadCatalog(discipline)
  const rows = await db.execute<{ slug: string }>(sql`select slug from spot_types`)
  const known = new Set(rows.map((row) => row.slug))
  const unknown = [
    ...new Set(
      catalog.tricks.flatMap((trick) => trick.compatibleSpotTypes),
    ),
  ]
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug) => !known.has(slug))
  if (unknown.length > 0) {
    console.error(
      `Refusing to seed ${discipline}: unknown compatibleSpotTypes [${unknown.join(", ")}]. ` +
        `Add them to spot_types first.`,
    )
    process.exit(1)
  }
}

async function main() {
  const arg = process.argv[2]?.trim().toLowerCase()
  const { db } = getDbClient()
  try {
    if (!arg || arg === "all") {
      log.info("seed.tricks.all.start", { disciplines: ALL_DISCIPLINES })
      for (const discipline of ALL_DISCIPLINES) {
        await assertKnownSpotTypes(db, discipline)
        const { catalogId, trickCount } = await seedChallengeCatalogForDiscipline(
          db,
          discipline,
        )
        log.info("seed.tricks.done", { discipline, catalogId, trickCount })
      }
    } else {
      const discipline = parseDisciplineSlug(arg)
      if (!discipline) {
        console.error(
          `Usage: pnpm db:seed-tricks [discipline]\nDisciplines: ${DISCIPLINES_LIST} (omit or pass 'all' for all disciplines)`,
        )
        process.exit(1)
      }
      await assertKnownSpotTypes(db, discipline)
      const { catalogId, trickCount } = await seedChallengeCatalogForDiscipline(
        db,
        discipline,
      )
      log.info("seed.tricks.done", { discipline, catalogId, trickCount })
    }
  } finally {
    await closeDb()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
