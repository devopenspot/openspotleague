/**
 * Centralized cache lifetimes — single source of truth for `cacheLife` and
 * `revalidateTag(tag, profile)` (Next.js 16 requires the exact profile object
 * reference; inline literals with identical values do NOT match).
 *
 * Import these constants instead of re-declaring `{revalidate, stale, expire}`
 * literals in services. See docs/CACHING.md for the tag matrix.
 */
export const LIST_CACHE_LIFE = { revalidate: 300, stale: 600, expire: 3600 } as const
export const ITEM_CACHE_LIFE = { revalidate: 60, stale: 300, expire: 3600 } as const
export const WEATHER_CACHE_LIFE = { revalidate: 21600, stale: 21600, expire: 43200 } as const
export const HEALTH_CACHE_LIFE = { revalidate: 30, stale: 30, expire: 60 } as const
export const IMAGE_CACHE_LIFE = { revalidate: 3500, stale: 3600, expire: 3600 } as const
export const REPORT_CACHE_LIFE = { revalidate: 60, stale: 300, expire: 3600 } as const
export const PROFILE_CACHE_LIFE = { revalidate: 60, stale: 300, expire: 3600 } as const
export const AUTHZ_CACHE_LIFE = { revalidate: 60, stale: 300, expire: 3600 } as const
export const SHORT_LINK_CACHE_LIFE = { revalidate: 86400, stale: 604800, expire: 2592000 } as const
