# Caching and Egress

## Cache Components (Next.js 16)

`cacheComponents: true` is set in `next.config.mjs`. Cached service reads use `"use cache"` together with `cacheTag(...)` and `cacheLife(...)`.

### Choosing a cache scope

| Directive | Scope | Use for |
| --- | --- | --- |
| `"use cache: remote"` | Workers Response Store, shared across isolates | Public reads that many visitors share: map scope pages, directory, regions, spot types, cities, shuffle id lists, event and TV lists. Keep each entry under 2 MB and cache per page, never a whole country. |
| `"use cache"` | Workers Response Store | User-specific or low-fanout reads. |
| `"use cache: private"` | Per user | User-specific reads. |

### Profiles

`revalidateTag(tag, profile)` must receive the exact profile object exported from `src/lib/cache/lifetimes.ts`. Next 16 compares profiles by object identity, so an inline literal such as `{ revalidate: 300 }` will not match.

The exported profiles are `LIST_CACHE_LIFE`, `ITEM_CACHE_LIFE`, `WEATHER_CACHE_LIFE`, `HEALTH_CACHE_LIFE`, `IMAGE_CACHE_LIFE`, `REPORT_CACHE_LIFE`, `PROFILE_CACHE_LIFE`, `AUTHZ_CACHE_LIFE`, and `SHORT_LINK_CACHE_LIFE`.

## Deferred invalidation: `src/lib/cache/deferred.ts`

Never call `revalidateTag` inside a transaction. If you do, a concurrent request can repopulate the cache with pre-commit data, and a rollback still triggers a pointless rebuild.

- `withDbWrite` runs the operation inside `runWithDeferredCacheInvalidation`. Code inside it calls `queueTagRevalidate(tag, profile)`, and the queued tags are flushed only after commit.
- Use and extend the central helpers instead of hand-writing tag lists:
  - `revalidateSpotCaches(spotId, slug)` in `src/lib/services/spot/spots.ts`
  - `revalidateEventCaches(eventId, slug)` in `src/lib/services/event/events.ts`
  - `revalidateTvPaths()` in `src/lib/services/tv/tv.ts`
  - `revalidateTaxonomyPaths()` in `src/lib/services/taxonomy/taxonomy.ts`

## DB-free build

`pnpm build` must succeed without a database. Layouts call `connection()` and wrap DB reads in `withSafeDefault` / `withSafeDefaultResult` (`src/lib/utils/safe-fetch.ts`). Those helpers fall back to canonical empty values (`EMPTY_SPOT_LIST`, `EMPTY_SAVED_SPOTS`, `EMPTY_WEATHER`, `EMPTY_VERIFIED_SPOTS`), so a missing database or missing env renders empty pages instead of 500 errors.

## Supabase egress budget

- Runtime queries go through Hyperdrive on Workers, and Node scripts use the Supavisor shared pooler (`:6543`, transaction mode). Pooler traffic counts against the 5 GB/month unified egress quota, about 160 MB/day.
- **Reads take one round trip.** Use `withDbRead`, and never wrap a point read or read service in `db.transaction(...)`, because `BEGIN`/`COMMIT` adds two pooler round trips.
- **Weather is client-side only.** Spot weather is fetched in the browser via `/api/weather`. A per-spot `"use cache"` in `src/lib/weather/weather-cached.ts` absorbs repeat requests. Do not bring back an all-spots weather fetch in SSR or layouts.
- **Local development.** A `.env.local` pointing at `*.pooler.supabase.com` (on either `:6543` or `:5432`) is billed as production shared-pooler egress. `next dev` also invalidates `"use cache"` on every HMR save. Develop against a separate Supabase project or branch, or a local Supabase instance.
- **Logs are off-limits.** Never query Supabase logs from agents or scripts: no MCP `get_logs`, no Management API `/analytics/endpoints/logs*`, no automated Logs Explorer or log-based reports. Each query rescans its whole time window. The Free allowance is about 100 GB/month, and Oct 28–29 2026 consumed 228 GB. Investigate with Query Performance (`pg_stat_statements`) or `pnpm egress:snapshot` instead.
- **Supabase MCP.** If a Supabase MCP server is ever configured, it must use `https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true&features=docs,database`.

## RSC payload size

- Never send raw DB rows to Client Components. Define a minimal projection type that has only the fields the client renders (for example `MarqueeEventInput`, `MarqueeVideoInput`, `MapSpot`), and don't add `.raw` back-pointers.
- `RootLayout` mounts `UserProvider`, `SavedSpotsProvider`, `VerifiedSpotsProvider`, and `HydrationGate`. Child layouts (`/map`, `/tv`, `/games`) must not refetch their data or mount them again.

## Polling and realtime

- A high-cadence polling endpoint first runs a single transaction-free version query. If `version === knownVersion`, it returns `304` with an empty body before doing any other work. `src/app/api/games/[id]/route.ts` is the reference implementation.
- Client poll intervals must stay below the proxy tier limit. A 2 s poll is 30 requests/min, which needs a tier of at least 60.
- Realtime subscribers ignore any signal with `signalVersion <= currentVersion`. An explicit action refresh clears pending debounce timers.
- Completed and cancelled entities never change. Their GET handlers return `Cache-Control: private, max-age=300, stale-while-revalidate=3600`.
