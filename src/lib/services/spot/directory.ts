import { cache } from "react"
import { cacheLife, cacheTag } from "next/cache"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import { listRegions } from "@/lib/services/spot/regions"
import { listSpotTypes } from "@/lib/services/spot/spot-types"
import type { Region, SpotTypeEntity } from "@/lib/types"
import type { MapSpotListResult } from "@/lib/repositories/core/types"

export interface CommonDirectoryData {
  spots: MapSpotListResult
  regions: readonly Region[]
  spotTypes: readonly SpotTypeEntity[]
}

export async function runGetCommonDirectoryData(): Promise<CommonDirectoryData> {
  const spotRepo = await getSpotRepositoryAsync()
  const listPage = spotRepo.listForMapScope
    ? spotRepo.listForMapScope.bind(spotRepo)
    : spotRepo.list.bind(spotRepo)
  const [spots, regions, spotTypes] = await Promise.all([
    listPage(),
    listRegions(),
    listSpotTypes(),
  ])
  return { spots, regions, spotTypes }
}

async function getCommonDirectoryDataCached(): Promise<CommonDirectoryData> {
  "use cache: remote"
  cacheTag("directory:common")
  cacheLife(LIST_CACHE_LIFE)
  return runGetCommonDirectoryData()
}

// Request-scoped dedup (React.cache) + cross-request Next cache ("use cache").
// Sole caller is the MAP layout (`MapDataProviders`): the root layout
// hydrates only the regions/spotTypes catalogs, so the capped spot
// directory listed here stays a map-route working set and no longer
// feeds public-page spot filters.
export const getCommonDirectoryData = cache(getCommonDirectoryDataCached)
