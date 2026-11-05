import type { SportDiscipline } from "@/types/disciplines"
import type { Contest, ContestCategory } from "@/types/league"
import type {
  NewSportEvent,
  SportEventPatch,
  SportEventFacetCountry,
  SportEventFacetDiscipline,
  SportEventFacetCategory,
} from "../core/types"
import type { ContentDeleteResult, EventShuffleFilters } from "../core/types"

export interface SportEventListResult {
  items: readonly Contest[]
  nextCursor: string | null
  /** True when another page can be requested with `nextCursor`. */
  hasMore: boolean
}

export interface SportEventQuery {
  q?: string
  country?: string
  citySlug?: string
  category?: ContestCategory
  discipline?: SportDiscipline
  featured?: boolean
  from?: string
  to?: string
  cursor?: string
  seed?: string
  random?: boolean
  limit?: number
}

export interface EventMediaState {
  imagePath: string | null
}

export interface EventRepository {
  list(query?: SportEventQuery): Promise<SportEventListResult>
  /**
   * Filter-only ID list backing seeded shuffle pagination. Served
   * through the cached `listEventShuffleIds` service (shared across
   * visitors) — never call per page view uncached.
   */
  listShuffledIds(query: EventShuffleFilters): Promise<string[]>
  /**
   * Full joined rows for page IDs, in no guaranteed order — the caller
   * restores shuffle order before returning.
   */
  listByIds(ids: readonly string[]): Promise<readonly Contest[]>
  listMap(query?: {
    citySlug?: string
    limit?: number
  }): Promise<readonly Contest[]>
  findById(id: string): Promise<Contest | null>
  findMediaState(id: string): Promise<EventMediaState | null>
  findFeatured(): Promise<Contest | null>
  listCountries(): Promise<readonly SportEventFacetCountry[]>
  listCategories(): Promise<readonly SportEventFacetCategory[]>
  listDisciplines(): Promise<readonly SportEventFacetDiscipline[]>
  count(): Promise<number>
  create(input: NewSportEvent): Promise<Contest>
  update(
    id: string,
    patch: SportEventPatch,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<Contest>
  delete(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<ContentDeleteResult>
}
