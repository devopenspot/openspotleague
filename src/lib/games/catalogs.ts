import rollerCatalog from "@/data/tricks/roller.json"
import skateboardCatalog from "@/data/tricks/skateboard.json"
import bmxCatalog from "@/data/tricks/bmx.json"
import scooterCatalog from "@/data/tricks/scooter.json"
import { trickCatalogSchema, type DisciplineSlug, type TrickCatalog } from "@/lib/schemas/game"
import { SPOT_TYPE_SEED } from "@/db/seed-data/taxonomy"

const KNOWN_SPOT_TYPE_SLUGS = new Set(SPOT_TYPE_SEED.map((type) => type.slug))

export function validateTrickCatalog(slug: DisciplineSlug, source: unknown): TrickCatalog {
  const parsed = trickCatalogSchema.parse(source)
  if (parsed.discipline !== slug) {
    throw new Error(`Catalog ${slug} declares discipline ${parsed.discipline}`)
  }
  const ids = new Set<string>()
  for (const trick of parsed.tricks) {
    if (ids.has(trick.id)) throw new Error(`Catalog ${slug} contains duplicate trick id ${trick.id}`)
    ids.add(trick.id)
    if (trick.discipline !== slug) {
      throw new Error(`Trick ${trick.id} in catalog ${slug} declares discipline ${trick.discipline}`)
    }
    for (const spotType of trick.compatibleSpotTypes) {
      if (!KNOWN_SPOT_TYPE_SLUGS.has(spotType)) {
        throw new Error(`Trick ${trick.id} in catalog ${slug} references unknown spot type ${spotType}`)
      }
    }
    if (trick.level < 1 || trick.level > 5) {
      throw new Error(`Trick ${trick.id} in catalog ${slug} has invalid level ${trick.level}`)
    }
  }
  return parsed
}

export const TRICK_CATALOGS: Record<DisciplineSlug, TrickCatalog> = {
  roller: validateTrickCatalog("roller", rollerCatalog),
  skateboard: validateTrickCatalog("skateboard", skateboardCatalog),
  bmx: validateTrickCatalog("bmx", bmxCatalog),
  scooter: validateTrickCatalog("scooter", scooterCatalog),
}

export function catalogForDiscipline(discipline: DisciplineSlug): TrickCatalog {
  return TRICK_CATALOGS[discipline]
}
