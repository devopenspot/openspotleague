import type { Spot } from "@/lib/types"
import type {
  ContentDeleteResult,
  MapSpotListResult,
  NewSpot,
  SpotCard,
  SpotFacetCity,
  SpotFacetRegion,
  SpotListResult,
  SpotModerationResult,
  SpotPatch,
  SpotQuery,
  SpotShuffleFilters,
} from "../core/types"

export interface CountryListResult {
  items: readonly { iso2: string; name: string; region: string }[]
  /**
    * Cheap name -> ISO 3166-1 alpha-2 lookup built from the same
    * `items` array for consumers that need to resolve the upstream
    * API code for a country without another DB round-trip.
   */
  countryIso2ByName: Readonly<Record<string, string>>
}

export interface SpotMediaState {
  imagePath: string | null
}

export interface SpotRepository {
  list(query?: SpotQuery): Promise<SpotListResult>
  listForMapScope(query?: SpotQuery): Promise<MapSpotListResult>
  /**
   * Filter-only ID list backing seeded shuffle pagination. Served
   * through the cached `listSpotShuffleIds` service (shared across
   * visitors) — never call per page view uncached.
   */
  listShuffledIds(query: SpotShuffleFilters): Promise<string[]>
  /**
   * Slim card rows for page IDs (no guaranteed order — the caller
   * restores shuffle order before returning).
   */
  listCardsByIds(ids: readonly string[]): Promise<SpotCard[]>
  listCreated(userId: string, query?: SpotQuery): Promise<SpotListResult>
  findById(id: string): Promise<Spot | null>
  findByIdForUser(id: string, userId: string | null): Promise<Spot | null>
  findBySlug(slug: string): Promise<Spot | null>
  findMediaState(id: string): Promise<SpotMediaState | null>
  findNearest(params: {
    lat: number
    lon: number
    radiusMeters: number
    disciplineSlug: string
    spotTypeSlugs: readonly string[]
  }): Promise<Spot | null>
  findNearby(params: { lat: number; lon: number; radiusMeters: number }): Promise<readonly Spot[]>
  findNearbyPublic(params: { lat: number; lon: number; radiusMeters: number }): Promise<readonly Spot[]>
  listCountries(): Promise<readonly { name: string; region: string; count: number }[]>
  listCountriesForRegion(region: string): Promise<readonly { name: string; count: number }[]>
  listTypes(): Promise<readonly { name: string; count: number }[]>
  listAllSpotTypes(): Promise<
    readonly { slug: string; name: string; sortOrder: number }[]
  >
  listAllCountries(): Promise<CountryListResult>
  listRegions(): Promise<readonly SpotFacetRegion[]>
  /**
   * Distinct city slugs (plus a display name) of the public, non-hidden
   * spots for `country`, ordered by true spot count (descending) then name.
   * Powers the searcher's city drill-down when the capped client directory
   * cannot prove a complete list for the browsed country.
   */
  listCitiesForCountry(country: string): Promise<readonly SpotFacetCity[]>
  count(): Promise<number>
  countPublic(): Promise<number>
  create(input: NewSpot): Promise<Spot>
  createPersonal(input: NewSpot, opts: { submissionHash: string }): Promise<Spot>
  update(
    id: string,
    patch: SpotPatch,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<Spot>
  /**
   * Moderation hard-delete for every origin (`seed`, `community`,
   * `user_personal`). Game history is detached with snapshots rather than
   * destroyed (lobbies are removed, active games cancelled+detached,
   * finished games detached — see `detachSpotDependents`); user-signal rows
   * cascade and the community ledger nullifies at the DB level. Explicit
   * soft-hides remain available via `hideSpot`/`hideCluster`.
   */
  delete(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<ContentDeleteResult>
  hideSpot(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<ContentDeleteResult>
  hideCluster(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<SpotModerationResult>
  unhideSpot(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<ContentDeleteResult>
}
