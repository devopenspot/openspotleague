import { cacheLife, cacheTag } from "next/cache"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"
import type { SpotFacetCity } from "@/lib/repositories/core/types"

/**
 * Server-truth city list for the searcher's city drill-down (step 03):
 * every distinct city (canonical `citySlug`) of one country, ordered by
 * true spot volume server-side. The hydrated client directory is capped
 * at `SPOT_LIST_HARD_CAP`, so a freshly picked country's client-derived
 * city list is a name-ordered sliver (Colombia could surface one row) —
 * this read guarantees a complete, correctly-ordered list.
 *
 * Counts are not shipped: the consumer displays no numbers, so the facet
 * carries slugs and names only. Per-country results are cached and tagged
 * like the other public list reads.
 */

export async function runListCitiesForCountry(
  country: string,
): Promise<readonly SpotFacetCity[]> {
  const repo = await getSpotRepositoryAsync()
  return repo.listCitiesForCountry(country)
}

export async function listCitiesForCountry(
  country: string,
): Promise<readonly SpotFacetCity[]> {
  "use cache"
  // Same tag the map-country and standard list services carry: every
  // spot mutation already revalidates "spots:list" via
  // `revalidateSpotCaches`, keeping these facet reads fresh without
  // extra tag plumbing.
  cacheTag("spots:list")
  cacheLife(LIST_CACHE_LIFE)
  return runListCitiesForCountry(country)
}
