import { GameDomainError } from "@/lib/games/definitions"
import type { TrickSnapshot } from "@/lib/games/definitions"
import type { TrickCatalog, TrickLevel } from "@/lib/schemas/game"

function fail(code: ConstructorParameters<typeof GameDomainError>[0], message: string): never {
  throw new GameDomainError(code, message)
}

export function eligiblePool(
  catalog: TrickCatalog,
  spotType: string,
  level: TrickLevel,
  selectedCategories: readonly string[] | null | undefined,
): TrickCatalog["tricks"] {
  const normalized =
    selectedCategories && selectedCategories.length > 0
      ? new Set(selectedCategories.map((c) => c.toLowerCase()))
      : null
  return catalog.tricks.filter((trick) => {
    if (trick.level !== level || !trick.compatibleSpotTypes.includes(spotType)) return false
    if (!normalized) return true
    return trick.categories.some((c) => normalized.has(c.toLowerCase()))
  })
}

export function hasCompatible(
  catalog: TrickCatalog,
  spotType: string,
  level: TrickLevel,
  selectedCategories: readonly string[] | null | undefined,
): boolean {
  return eligiblePool(catalog, spotType, level, selectedCategories).length > 0
}

export function remainingCount(
  catalog: TrickCatalog,
  spotType: string,
  level: TrickLevel,
  selectedCategories: readonly string[] | null | undefined,
  usedTrickIds: readonly string[],
): number {
  const pool = eligiblePool(catalog, spotType, level, selectedCategories)
  if (pool.length === 0) return 0
  const used = new Set(usedTrickIds)
  return pool.filter((t) => !used.has(t.id)).length
}

function trickSnapshotFor(catalog: TrickCatalog, trickId: string): TrickSnapshot {
  const trick = catalog.tricks.find((candidate) => candidate.id === trickId)
  if (!trick) fail("NO_COMPATIBLE_TRICK", "The selected trick is not part of the discipline catalog")
  return {
    id: trick.id,
    name: trick.name,
    description: trick.description,
    level: trick.level,
    catalogTrickId: null,
    sourceId: trick.id,
    discipline: trick.discipline,
    compatibleSpotTypes: trick.compatibleSpotTypes,
    categories: [...(trick.categories ?? [])],
  }
}

/**
 * Deterministic trick selection: the lexicographically smallest unused
 * trick id from the eligible set for the given spot type and level,
 * filtered by selectedCategories when provided.
 */
export function selectTrickForSpotType(
  catalog: TrickCatalog,
  spotType: string,
  level: TrickLevel,
  usedTrickIds: readonly string[],
  selectedCategories?: readonly string[] | null,
): TrickSnapshot {
  const pool = eligiblePool(catalog, spotType, level, selectedCategories)
  if (pool.length === 0) fail("NO_COMPATIBLE_TRICK", "No trick matches the selected spot type, level, and categories")
  const used = new Set(usedTrickIds)
  const eligible = pool.map((trick) => trick.id).sort()
  const candidate = eligible.find((trickId) => !used.has(trickId)) ?? (eligible[0] as string)
  return trickSnapshotFor(catalog, candidate)
}

export function selectAlternativeTrickForSpotType(
  catalog: TrickCatalog,
  spotType: string,
  level: TrickLevel,
  excludedTrickIds: readonly string[],
  selectedCategories?: readonly string[] | null,
): TrickSnapshot {
  const pool = eligiblePool(catalog, spotType, level, selectedCategories)
  const excluded = new Set(excludedTrickIds)
  const candidate = pool
    .sort((left, right) => left.id.localeCompare(right.id))
    .find((trick) => !excluded.has(trick.id))

  if (!candidate) fail("NO_COMPATIBLE_TRICK", "No alternative trick is available for this spot type and level")
  return trickSnapshotFor(catalog, candidate.id)
}

export function selectTrickForCategories(
  catalog: TrickCatalog,
  spotType: string,
  level: TrickLevel,
  selectedCategories: readonly string[] | null,
  usedTrickIds: readonly string[],
): TrickSnapshot {
  return selectTrickForSpotType(catalog, spotType, level, usedTrickIds, selectedCategories)
}

export function exhaustedReason(level: TrickLevel, spotType: string, nextLevel: TrickLevel | null): string {
  // Preserve original wording variants: all call sites previously used "with selected categories" when advancing, without when switching.
  // We normalize to the most common variant seen in tests: with categories when nextLevel else without.
  if (nextLevel) {
    return `Exhausted level ${level} for ${spotType} with selected categories — advance to level ${nextLevel}`
  }
  return `Exhausted level ${level} for ${spotType} — switch spot type or categories`
}
