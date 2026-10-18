import { cacheLife, cacheTag } from "next/cache"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

export interface CountryOption {
  iso2: string
  name: string
  region: string
}

export interface CountryListProjection {
  items: readonly CountryOption[]
  /**
     * Cheap name -> ISO 3166-1 alpha-2 lookup built from the same
     * `items` array for consumers that need to resolve a country
     * name to an upstream API code without another DB round-trip.
     */
  countryIso2ByName: Readonly<Record<string, string>>
}

/**
 * Filters are applied in-memory after fetching all countries/regions.
 * Mutations in `src/lib/services/admin-regions.ts` call
 * `revalidateTag("countries:all", LIST_CACHE_LIFE)` so admin edits
 * propagate within 60s.
 */
function filterCountries(
  rows: readonly CountryOption[],
  query: string,
): readonly CountryOption[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return rows
  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(q) ||
      row.region.toLowerCase().includes(q),
  )
}

export async function runListCountries(
  query: string,
): Promise<CountryListProjection> {
  const repo = await getSpotRepositoryAsync()
  const { items, countryIso2ByName } = await repo.listAllCountries()
  return { items: filterCountries(items, query), countryIso2ByName }
}

export async function listCountries(
  query: string,
): Promise<CountryListProjection> {
  "use cache"
  cacheTag("countries:all")
  cacheLife(LIST_CACHE_LIFE)
  return runListCountries(query)
}
