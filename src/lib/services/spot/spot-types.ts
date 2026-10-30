import { cacheLife, cacheTag } from "next/cache"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import type { SpotTypeEntity } from "@/lib/types"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

export async function runListSpotTypes(): Promise<readonly SpotTypeEntity[]> {
  const repo = await getSpotRepositoryAsync()
  const rows = await repo.listAllSpotTypes()
  return rows.map((r) => ({ slug: r.slug, name: r.name }))
}

export async function listSpotTypes(): Promise<readonly SpotTypeEntity[]> {
  "use cache: remote"
  cacheTag("spot-types:all")
  cacheLife(LIST_CACHE_LIFE)
  return runListSpotTypes()
}
