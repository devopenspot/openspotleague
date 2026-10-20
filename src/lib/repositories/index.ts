import { getDbClient, withDbRetry } from "@/lib/db/client"
import { DrizzleSpotRepository } from "./spot/drizzle-spot-repository"
import { DrizzleEventRepository } from "./event/drizzle-event-repository"
import { DrizzleSavedSpotsRepository } from "./spot/drizzle-saved-spots-repository"
import { DrizzleVerifiedSpotsRepository } from "./spot/drizzle-verified-spots-repository"
import { DrizzleWeatherVerificationRepository } from "./spot/drizzle-weather-verification-repository"
import { DrizzleTaxonomyRepository } from "./taxonomy/drizzle-taxonomy-repository"
import { DrizzleTvRepository } from "./tv/drizzle-tv-repository"
import { DrizzleAdminUserRepository } from "./admin/drizzle-admin-user-repository"
import { DrizzleAdminRegionRepository } from "./admin/drizzle-admin-region-repository"
import { DrizzleShortLinkRepository } from "./short-link/drizzle-short-link-repository"
import type { SpotRepository } from "./spot/spot-repository"
import type { EventRepository } from "./event/event-repository"
import type { SavedSpotsRepository } from "./spot/saved-spots-repository"
import type { VerifiedSpotsRepository } from "./spot/verified-spots-repository"
import type { WeatherVerificationRepository } from "./spot/weather-verification-repository"
import type { TaxonomyRepository } from "./taxonomy/taxonomy-repository"
import type { TvRepository } from "./tv/tv-repository"
import type { AdminUserRepository } from "./admin/admin-user-repository"
import type { AdminRegionRepository } from "./admin/admin-region-repository"
import type { ShortLinkRepository } from "./short-link/short-link-repository"

let spotRepository: SpotRepository | null = null
let eventRepository: EventRepository | null = null
let savedSpotsRepository: SavedSpotsRepository | null = null
let verifiedSpotsRepository: VerifiedSpotsRepository | null = null
let weatherVerificationRepository: WeatherVerificationRepository | null = null
let taxonomyRepository: TaxonomyRepository | null = null
let tvRepository: TvRepository | null = null
let adminUserRepository: AdminUserRepository | null = null
let adminRegionRepository: AdminRegionRepository | null = null
let shortLinkRepository: ShortLinkRepository | null = null

// A connection failure can happen after a write has committed. Reads can be
// retried safely; writes require an explicit idempotency strategy at the
// operation boundary instead of an automatic retry.
const NON_RETRYABLE_METHODS = new Set([
  "create",
  "createPersonal",
  "update",
  "delete",
  "hideSpot",
  "hideCluster",
  "unhideSpot",
  "upsertBySlug",
  "save",
  "unsave",
  "verify",
  "unverify",
  "saveTrick",
  "deleteTrick",
  "updateSport",
  "deleteSport",
  "createSpotType",
  "updateSpotType",
  "deleteSpotType",
])

/**
 * Wraps every method of a repository instance in `withDbRetry`.
 * Returns a Proxy that preserves the original type. The retry happens
 * at the method boundary so every DB call — read or write, including
 * ones callers forget to wrap — gets the standard 15s deadline and
 * 3-attempt retry on transient connection errors.
 *
 * Reads run directly on the shared `db` (no BEGIN/COMMIT) — saves 2 RTT
 * per query. Writes keep `db.transaction` for atomicity and OCC.
 * `statement_timeout` is still enforced via the postgres connection
 * option (statementTimeout 8s) so reads remain bounded.
 */
function withRetryAll<T extends object>(
  repo: T,
  repositoryName: string,
  db: ReturnType<typeof getDbClient>["db"],
): T {
  const Repository = repo.constructor as new (db: unknown) => T
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== "function") return value
      const isWrite = NON_RETRYABLE_METHODS.has(String(prop))
      if (isWrite) {
        return (...args: unknown[]) =>
          withDbRetry(
            () =>
              db.transaction(async (tx) => {
                const scopedRepository = new Repository(tx)
                const scopedValue = Reflect.get(scopedRepository, prop)
                if (typeof scopedValue !== "function") {
                  throw new Error(`${repositoryName}.${String(prop)} is not callable`)
                }
                return (scopedValue as (...a: unknown[]) => Promise<unknown>).apply(
                  scopedRepository,
                  args,
                )
              }),
            `${repositoryName}.${String(prop)}`,
            { retryOnConnectionError: false },
          )
      }
      // Read path — no transaction, no extra RTT
      return (...args: unknown[]) =>
        withDbRetry(
          () => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args),
          `${repositoryName}.${String(prop)}`,
          { retryOnConnectionError: true },
        )
    },
  })
}

function getDrizzleRepos() {
  const { db } = getDbClient()
  return {
    spot: withRetryAll(new DrizzleSpotRepository(db), "spots", db),
    event: withRetryAll(new DrizzleEventRepository(db), "events", db),
    savedSpots: withRetryAll(
      new DrizzleSavedSpotsRepository(db),
      "saved_spots",
      db,
    ),
    verifiedSpots: withRetryAll(
      new DrizzleVerifiedSpotsRepository(db),
      "verified_spots",
      db,
    ),
    weatherVerifications: withRetryAll(
      new DrizzleWeatherVerificationRepository(db) as unknown as WeatherVerificationRepository,
      "weather_verifications",
      db,
    ),
    tv: withRetryAll(new DrizzleTvRepository(db), "tv_videos", db),
    shortLink: withRetryAll(new DrizzleShortLinkRepository(db), "short_links", db),
  }
}

export async function getSpotRepositoryAsync(): Promise<SpotRepository> {
  if (!spotRepository) {
    spotRepository = getDrizzleRepos().spot
  }
  return spotRepository
}

export async function getEventRepositoryAsync(): Promise<EventRepository> {
  if (!eventRepository) {
    eventRepository = getDrizzleRepos().event
  }
  return eventRepository
}

export async function getSavedSpotsRepositoryAsync(): Promise<SavedSpotsRepository> {
  if (!savedSpotsRepository) {
    savedSpotsRepository = getDrizzleRepos().savedSpots
  }
  return savedSpotsRepository
}

export async function getVerifiedSpotsRepositoryAsync(): Promise<VerifiedSpotsRepository> {
  if (!verifiedSpotsRepository) {
    verifiedSpotsRepository = getDrizzleRepos().verifiedSpots
  }
  return verifiedSpotsRepository
}

export async function getWeatherVerificationRepositoryAsync(): Promise<WeatherVerificationRepository> {
  if (!weatherVerificationRepository) {
    weatherVerificationRepository = (getDrizzleRepos() as unknown as { weatherVerifications: WeatherVerificationRepository }).weatherVerifications
  }
  return weatherVerificationRepository
}

export async function getTaxonomyRepositoryAsync(): Promise<TaxonomyRepository> {
  if (!taxonomyRepository) {
    const { db } = getDbClient()
    taxonomyRepository = withRetryAll(new DrizzleTaxonomyRepository(db), "taxonomy", db)
  }
  return taxonomyRepository
}

export async function getTvRepositoryAsync(): Promise<TvRepository> {
  if (!tvRepository) {
    tvRepository = getDrizzleRepos().tv
  }
  return tvRepository
}

export async function getAdminUserRepositoryAsync(): Promise<AdminUserRepository> {
  if (!adminUserRepository) {
    const { db } = getDbClient()
    adminUserRepository = withRetryAll(
      new DrizzleAdminUserRepository(db),
      "admin.users",
      db,
    )
  }
  return adminUserRepository
}

export async function getAdminRegionRepositoryAsync(): Promise<AdminRegionRepository> {
  if (!adminRegionRepository) {
    const { db } = getDbClient()
    adminRegionRepository = withRetryAll(
      new DrizzleAdminRegionRepository(db),
      "admin.regions",
      db,
    )
  }
  return adminRegionRepository
}

export async function getShortLinkRepositoryAsync(): Promise<ShortLinkRepository> {
  if (!shortLinkRepository) {
    shortLinkRepository = getDrizzleRepos().shortLink
  }
  return shortLinkRepository
}

export { DrizzleSpotRepository } from "./spot/drizzle-spot-repository"
export { DrizzleEventRepository } from "./event/drizzle-event-repository"
export { DrizzleSavedSpotsRepository } from "./spot/drizzle-saved-spots-repository"
export { DrizzleVerifiedSpotsRepository } from "./spot/drizzle-verified-spots-repository"
export { DrizzleWeatherVerificationRepository } from "./spot/drizzle-weather-verification-repository"
export { DrizzleTaxonomyRepository } from "./taxonomy/drizzle-taxonomy-repository"
export { DrizzleTvRepository } from "./tv/drizzle-tv-repository"
export { DrizzleAdminUserRepository } from "./admin/drizzle-admin-user-repository"
export { DrizzleAdminRegionRepository } from "./admin/drizzle-admin-region-repository"
export { DrizzleShortLinkRepository } from "./short-link/drizzle-short-link-repository"
export type { ShortLinkRepository, CreateShortLinkInput } from "./short-link/short-link-repository"
export type { SpotRepository } from "./spot/spot-repository"
export type { EventRepository } from "./event/event-repository"
export type { SavedSpotsRepository } from "./spot/saved-spots-repository"
export type { VerifiedSpotsRepository } from "./spot/verified-spots-repository"
export type { WeatherVerificationRepository, WeatherVerificationSummary } from "./spot/weather-verification-repository"
export type {
  TaxonomyRepository,
  TaxonomyEntry,
  TaxonomyPatch,
  TrickCatalog,
  TrickCatalogEntry,
  TrickMutationOptions,
} from "./taxonomy/taxonomy-repository"
export type { TvRepository, TvListOptions } from "./tv/tv-repository"
export type {
  AdminRoleOption,
  AdminUserListCursor,
  AdminUserListOptions,
  AdminUserListResult,
  AdminUserRepository,
  AdminUserRoleAssignment,
  AdminUserSummary,
} from "./admin/admin-user-repository"
export type {
  AdminRegion,
  AdminCountry,
  AdminRegionPatch,
  AdminCountryPatch,
  AdminRegionRepository,
} from "./admin/admin-region-repository"
export type {
  ContentDeleteResult,
  NewSpot,
  SpotPatch,
  SpotQuery,
} from "./core/types"
export type { SportEventQuery, SportEventListResult } from "./event/event-repository"
