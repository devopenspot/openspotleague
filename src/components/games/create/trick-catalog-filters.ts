import type { TrickLevel } from "@/lib/schemas/game";

/** Structural subset of a trick definition the create-form filters need. */
export type CatalogTrick = {
  level: number;
  compatibleSpotTypes: readonly string[];
  categories: readonly string[];
};

function categorySet(categories: readonly string[]): Set<string> | null {
  if (categories.length === 0) return null;
  return new Set(categories.map((c) => c.toLowerCase()));
}

function trickMatchesCategories(
  trick: CatalogTrick,
  cats: Set<string> | null,
): boolean {
  if (!cats) return true;
  return trick.categories.some((c) => cats.has(String(c).toLowerCase()));
}

/**
 * Levels present in the catalog for spotType ∧ selectedCategories.
 * Falls back to the spot's own levels when the catalog is empty, no
 * categories are selected, or no trick matches the combination.
 */
export function computeLevelsForSpotAndCategories(
  tricks: readonly CatalogTrick[],
  spotType: string,
  categories: readonly string[],
  fallbackLevels: readonly number[],
): TrickLevel[] {
  if (tricks.length === 0) return [...fallbackLevels] as TrickLevel[];
  if (categories.length === 0) return [...fallbackLevels] as TrickLevel[];
  const cats = categorySet(categories);
  const levels = new Set<TrickLevel>();
  for (const t of tricks) {
    if (!t.compatibleSpotTypes.includes(spotType)) continue;
    if (!trickMatchesCategories(t, cats)) continue;
    levels.add(t.level as TrickLevel);
  }
  const sorted = [...levels].sort((a, b) => a - b) as TrickLevel[];
  return sorted.length > 0 ? sorted : ([...fallbackLevels] as TrickLevel[]);
}

/** Per-level trick counts for spotType ∧ selectedCategories. */
export function countTricksPerLevel(
  tricks: readonly CatalogTrick[],
  spotType: string,
  categories: readonly string[],
): Map<TrickLevel, number> {
  const map = new Map<TrickLevel, number>();
  for (const lvl of [1, 2, 3, 4, 5] as TrickLevel[]) map.set(lvl, 0);
  if (tricks.length > 0 && spotType) {
    const cats = categorySet(categories);
    for (const t of tricks) {
      if (!t.compatibleSpotTypes.includes(spotType)) continue;
      if (!trickMatchesCategories(t, cats)) continue;
      map.set(
        t.level as TrickLevel,
        (map.get(t.level as TrickLevel) ?? 0) + 1,
      );
    }
  }
  return map;
}

/** Per-category trick counts for spotType ∧ level (case-insensitive keys). */
export function countTricksPerCategory(
  tricks: readonly CatalogTrick[],
  spotType: string,
  level: TrickLevel,
  allCategories: readonly string[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const cat of allCategories) map.set(cat, 0);
  if (tricks.length > 0 && level && spotType) {
    for (const t of tricks) {
      if (
        t.level !== level ||
        !t.compatibleSpotTypes.includes(spotType)
      )
        continue;
      for (const c of t.categories) {
        const lc = String(c).trim().toLowerCase();
        if (!lc) continue;
        map.set(lc, (map.get(lc) ?? 0) + 1);
      }
    }
  }
  return map;
}

/**
 * Exact-triple eligible count (level ∧ spotType ∧ categories).
 * Returns null when the catalog is empty — "unknown", not "zero".
 */
export function countEligibleTricks(
  tricks: readonly CatalogTrick[],
  level: TrickLevel,
  spotType: string,
  categories: readonly string[],
): number | null {
  if (tricks.length === 0) return null;
  const cats = categorySet(categories);
  return tricks.filter((t) => {
    if (
      t.level !== level ||
      !t.compatibleSpotTypes.includes(spotType)
    )
      return false;
    return trickMatchesCategories(t, cats);
  }).length;
}
