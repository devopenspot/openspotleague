# Architecture

## Request lifecycle: `src/proxy.ts`

Next.js 16 uses `proxy.ts` in place of `middleware.ts`. For every request, the proxy:

1. **Request id.** It generates or propagates the `x-request-id` header.
2. **Bypass.** `isProxyBypassPath` sends `/s`, `/s/*`, `/api/health*`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/manifest.json`, `/favicon.ico`, `/icon`, and `/apple-icon` straight through, with no rate limiting, seed cookie, or auth refresh.
3. **Rate limiting.** `RATE_LIMIT_TIERS` applies a sliding window per IP, held in memory per instance. It is skipped when `NODE_ENV === "test"`. The first matching tier wins:

   | Prefix | Tier | Limit/min |
   | --- | --- | --- |
   | `/api/admin` | admin-api | 60 |
   | `/api/auth` | auth | 20 |
   | `/api/games` | games | 60 |
   | `/api/league` | league | 60 |
   | `/api/notifications` | notifications | 60 |
   | `/api/weather` | weather | 20 |
   | `/api/short-links` | short-links | 30 |
   | `/api/health` | health | 10 |
   | `/api/tv/ids` | tv-ids | 20 |
   | `/api/tv` | tv | 60 |
   | public read routes | public-read | 60, only when `RATE_LIMIT_PUBLIC_ENABLED` is set |
   | `/api/saved-spots`, `/api/verified-spots`, `/api/spot-verifications` | profile-read | 60 |

   The `health` tier never fires today, because `/api/health` is caught by the bypass in step 2 first.
4. **Seed cookie.** `osp_seed` (7 days, `SameSite=Lax`) gives each visit its own shuffle for random pagination on the landing and explore pages. Every other path stays cookie-free, so the CDN can cache anonymous responses.
5. **Supabase session refresh.** It is skipped for anonymous requests (no `sb-*-auth-token` cookie) and for prefetches (`isPrefetchRequest`). JWT verification uses a cached JWKS (`getCachedJwks`).
6. **Security headers.** See [Security headers](#security-headers).

## Layers

```
page / route handler ──► src/lib/services/* ──► src/lib/repositories/* (interface) ──► Drizzle implementation
                              │
                              └─► src/lib/games/*, src/lib/league/*  (pure engines, no IO)
```

- Pages and route handlers never import Drizzle or `@/db/schema`.
- **Pure engines** (`src/lib/games`, `src/lib/league`) hold the state machines, scoring, capability checks, location verification, training limits, and trick selection. Trick selection uses a seeded Mulberry32 shuffle. Each module has a sibling `*.test.ts`.
- **Services** (`src/lib/services/games/*`, `src/lib/services/league/*`) are the only writers for games and league events. Every mutation:
  - runs inside `withDbWrite` + `db.transaction`;
  - checks `expectedVersion` (optimistic concurrency);
  - is replayed idempotently using a canonical-JSON `requestFingerprint`, stored in `game_action_requests` or `event_action_requests`;
  - writes a realtime signal row to `game_realtime_signals` or `event_realtime_signals`.
- **Deprecated shims.** About 65 one-line `@deprecated — moved to …` re-export files remain at the top level of `src/lib`, `src/lib/services`, and `src/lib/repositories`. Always import the canonical path that the shim names.

## Repositories: `src/lib/repositories/index.ts`

The Spot, Event, SavedSpots, VerifiedSpots, WeatherVerification, Taxonomy, Tv, AdminUser, AdminRegion, and ShortLink repositories are each wrapped in a Proxy by `withRetryAll`:

- **Reads** run directly on the shared Drizzle client (no `BEGIN`/`COMMIT`). They go through `withDbRetry`, which makes 3 attempts with a 15 s deadline on transient connection errors.
- **Writes** (`create`, `update`, `delete`, …) are wrapped automatically in `db.transaction` with `retryOnConnectionError: false`.

Resolve repositories with `get<Entity>RepositoryAsync()` or the exported proxies.

## Database client: `src/lib/db/client.ts`

- `withDbRead`: transaction-free reads.
- `withDbWrite`: writes. It also runs `runWithDeferredCacheInvalidation` (see `caching-and-egress.md`).
- `withDbRetry`: retries, plus a global concurrency gate (`withGlobalDbConcurrency`, bounded by `CONCURRENCY_MAX ≤ POOL_MAX`). Do not add per-route connection gating.

Pool settings come from environment variables, validated in `src/lib/config/env.ts`:

| Env var | Default |
| --- | --- |
| `DB_POOL_MAX` | 3 in production, 5 otherwise (max 5) |
| `DB_CONCURRENCY_MAX` | `DB_POOL_MAX` |
| `DB_STATEMENT_TIMEOUT_MS` | 8000 |
| `DB_CONNECT_TIMEOUT_SECONDS` | 5 |
| `DB_IDLE_TIMEOUT_SECONDS` | 5 |
| `DB_MAX_LIFETIME_SECONDS` | 240 (below pgBouncer's 600 s `server_idle_timeout`, which avoids 57014 errors) |
| `DB_OPERATION_TIMEOUT_MS` | 15000 |
| `DB_POOL_CHECKOUT_TIMEOUT_MS` | 3000 |
| `DB_POOL_CHECKOUT_MAX_ATTEMPTS` | 3 |

### On Cloudflare Workers

Workers ties sockets and promises to the request that created them, so the Node model of one shared pool fails there: roughly every other request hits a dead socket.

- `src/worker.ts` opens a request scope (`src/lib/utils/request-scope.ts`), and `perRequest` gives each request its own client, concurrency gate, and in-flight maps. `DB_POOL_MAX` is therefore per request, not per instance. Workers allows six open connections per invocation.
- `getDbClient()` returns a facade on Workers, because repositories are cached singletons that keep their `db` reference. The facade resolves the current request's connection on each access.
- Cache regeneration enters through vinext's `ResponseStoreRevalidator`, which `src/worker.ts` cannot wrap: the build re-exports the original class over any override. `withScopedDbConcurrency` gives each DB operation there its own connection instead.
- The Worker reaches Postgres only through the `HYPERDRIVE` binding. Supabase's pooler uses a private CA, `workerd` rejects it (`TLS handshake failed: invalid peer certificate`), and postgres.js cannot skip that check on Workers. Direct connections from `pnpm dev` fail the same way, and layouts then render empty fallbacks with a 200.
- Local Hyperdrive runs on Node and connects without verifying the certificate, so it has no pooling or query cache. Production Hyperdrive must keep query caching disabled: it would otherwise serve reads up to 60 seconds old, which breaks `expectedVersion` checks and polling. The app's own cache layers handle caching.
- Node scripts are unaffected and keep using the pooler URLs.

## Deletion lifecycle

- Deletes of spots, events, and TV entries go through `deleteWithOccAudit` (`src/lib/repositories/core/occ-delete.ts`). It enforces `expectedDate` (If-Match) against `updatedAt` and writes to `content_audit_log`.
- Hard-deleting a spot also runs `detachSpotDependents` (`src/lib/repositories/spot/spot-delete-plan.ts`):
  - Lobby games are hard-deleted.
  - Active games are cancelled and detached (`spotId: null`, `spotRemoved: true`, `status: 'cancelled'`); their snapshots are kept.
  - Completed and cancelled games are detached and keep their display snapshots.
  - Challenge records get `spotNameSnapshot` and `spotSlugSnapshot` filled in place.
  - Weather reports and location verifications for that spot are deleted.
  - The database cascades `saved_spots`, `verified_spots`, `spot_weather_verifications`, and `spot_type_assignments`.
- Any new `RESTRICT → spots` foreign key must be handled here. An unhandled FK violation returns 409 by design.

## Admin route error mapping

`mapMutationErrorResponse` (`src/lib/api/admin-handler.ts`):

| Error | Status |
| --- | --- |
| `isInvalidConcurrencyTokenError` | 400 |
| `isStaleRecordError` | 409 |
| `isInvalidReferenceError` | 400 |
| `UploadValidationError` | 400 |
| `TimeoutError` or `isConnectionError` | 503 "The … service is temporarily unavailable" |
| A `notFoundPrefixes` match | 404 |
| Anything else | 500 "Internal error". The message is logged with `log.error` and never echoed to the client. |

## Auth and authorization

- Runtime authorization uses database roles and permissions (`src/lib/auth/server.ts`). Read paths use `getAuthorizationSnapshotCached(userId)`.
- `ADMIN_EMAILS` only matters at bootstrap; see `database.md`.
- Only `getAdminClient()` (`src/lib/auth/auth.ts`) and `src/lib/supabase/admin.ts` may read `SUPABASE_SECRET_KEY`.
- Browser code uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Security headers

Security headers are defined in two places that must be edited together:

1. `next.config.mjs` `headers()` covers static and build-time responses. The CSP string is duplicated inline there because the config file cannot import TypeScript.
2. `src/lib/security/headers.ts` (`securityHeaders`, `cspValue()`) is applied at runtime by the proxy.

TV routes (`/tv`, `/tv/*`) are embeddable. They get `frame-ancestors *`, and the proxy strips `X-Frame-Options`, `Cross-Origin-Opener-Policy`, and `Cross-Origin-Resource-Policy` from them. All other routes get `Content-Security-Policy-Report-Only`.
