import { cacheLife, cacheTag } from "next/cache"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

export async function lookupIso2ByName(name: string): Promise<string | null> {
  "use cache"
  cacheTag("countries:all")
  cacheLife(LIST_CACHE_LIFE)
  const repo = await getSpotRepositoryAsync()
  const { countryIso2ByName } = await repo.listAllCountries()
  return countryIso2ByName[name] ?? null
}
