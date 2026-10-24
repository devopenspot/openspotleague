# Repository Guide

Single private Next.js 16 App Router application ("OpenSpot" — interactive map of sports spots, community & editorial events, multiplayer challenge games, and action sports TV). Node 22 (`.nvmrc`), pnpm 10.34.5 pinned via `packageManager`. `pnpm-workspace.yaml` sets pnpm-only policies (`verifyDepsBeforeRun`, `minimumReleaseAge`, `allowBuilds`) — not a monorepo. No CI workflows in-repo; local checks are the verification gate.

## Verification

- `pnpm lint` → `eslint src` only (flat configuration in `eslint.config.mjs`).
- `pnpm typecheck` → `tsc --noEmit` (strict mode, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
- `pnpm test` → `vitest run`; watch mode: `pnpm test:watch` / `vitest`; single file: `pnpm test src/path/file.test.ts`.
- Vitest harness: runs in `happy-dom` with `globals: true`, configured in `vitest.config.ts` with `vitest.setup.ts`, stubs `server-only` (via `vitest.server-only.ts`), and aliases `@` → `./src/*`. Only tests in `src/**/*.{test,spec}.{ts,tsx}` are executed.
- `pnpm build` is DB-free: layouts call `connection()` and wrap DB reads in `withSafeDefault`/`withSafeDefaultResult` (`src/lib/utils/safe-fetch.ts`) with canonical empty fallbacks (`EMPTY_SPOT_LIST`, `EMPTY_SAVED_SPOTS`, `EMPTY_WEATHER`, `EMPTY_VERIFIED_SPOTS`) so missing DB/Supabase env renders empty fallbacks instead of 500s. Never introduce a database requirement into the build.

## Architecture & Call Flow

- `src/proxy.ts` is the Next.js 16 proxy (Next.js 16 replaces `middleware.ts` with `proxy.ts`):
  - Request tracking: Generates or propagates `x-request-id` header on every request.
  - Static bypass (`isProxyBypassPath`): `/s`, `/api/health`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/manifest.json`, `/icon`, `/apple-icon` bypass rate limiting and auth refresh entirely.
  - Tiered per-IP sliding rate limiting (`RATE_LIMIT_TIERS`): `admin-api` (60), `auth` (20), `games` (60), `league` (60), `notifications` (60), `weather` (20), `short-links` (30), `health` (10), `tv-ids` (20), `tv` (60), `profile-read` (60), and `public-read` (60, gated by `RATE_LIMIT_PUBLIC_ENABLED`). Bypassed in tests (`NODE_ENV === "test"`).
  - Seed cookie (`osp_seed`): 7-day `SameSite=Lax` per-visit shuffle for landing/explore random pagination; other paths stay cookie-free so the CDN edge can cache anonymous responses.
  - Supabase session refresh: Anonymous traffic (no `sb-*-auth-token` cookies) skips Supabase client allocation and JWT verification. Speculative prefetch requests (`isPrefetchRequest`) skip refresh to avoid token stampedes. Cached JWKS (`getCachedJwks`) avoids fetching `/.well-known/jwks.json` on every request.
  - Security headers: Applied to all responses. TV routes (`/tv`, `/tv/*`) get `frame-ancestors *` and strip `X-Frame-Options`, `Cross-Origin-Opener-Policy`, and `Cross-Origin-Resource-Policy`. All other routes apply `Content-Security-Policy-Report-Only`.
- Call flow: Pages / Route Handlers → `src/lib/services/*` → `src/lib/repositories/*` (interfaces) → Drizzle implementations.
  - HARD RULE: Never import Drizzle ORM or DB schemas directly from pages or route handlers.
- Pure Domain Engines vs. Service Orchestration:
  - Challenge games (`src/lib/games/*`) and league events (`src/lib/league/*`): Pure, unit-tested domain engines (state machines, scoring rules, capability checks, location verification, training limits, trick selection with Mulberry32 seeded shuffle; no DB/IO).
  - Service orchestration (`src/lib/services/games/*`, `src/lib/services/league/*`): The single writers. Every mutation runs inside `withDbWrite` + `db.transaction` + `expectedVersion` optimistic concurrency control (OCC) + idempotent replay via canonical JSON request fingerprints (`requestFingerprint` stored in `game_action_requests` or `event_action_requests`) + realtime signal records (`game_realtime_signals` or `event_realtime_signals`).
- Repository Proxy Pattern (`src/lib/repositories/index.ts`):
  - Every repository instance (`SpotRepository`, `EventRepository`, `SavedSpotsRepository`, `VerifiedSpotsRepository`, `WeatherVerificationRepository`, `TaxonomyRepository`, `TvRepository`, `AdminUserRepository`, `AdminRegionRepository`, `ShortLinkRepository`) is wrapped in a Proxy via `withRetryAll`.
  - Reads: Execute directly on the shared Drizzle client (no `BEGIN`/`COMMIT`, saving 2 RTTs), retried on transient connection errors (`withDbRetry`, 3 attempts, 15s deadline).
  - Writes: Non-retryable methods (`create`, `update`, `delete`, etc.) automatically execute in `db.transaction` with `retryOnConnectionError: false`.
  - Resolution: Always use `get<Entity>RepositoryAsync()` or the exported repository proxies from `src/lib/repositories/index.ts`.
- Deferred Cache Invalidation (`src/lib/cache/deferred.ts`):
  - Mutations must NEVER call `revalidateTag` inside a database transaction — a concurrent request could repopulate the cache from pre-commit data, and rolled-back transactions would trigger pointless cache rebuilds.
  - `withDbWrite` (`src/lib/db/client.ts`) wraps operations in `runWithDeferredCacheInvalidation`. Writes call `queueTagRevalidate(tag, profile)`; tags are only flushed after transaction commit.
  - Centralized invalidation helpers: `revalidateSpotCaches(spotId, slug)` (`src/lib/services/spot/spots.ts`), `revalidateEventCaches(eventId, slug)` (`src/lib/services/event/events.ts`), `revalidateTvPaths()` (`src/lib/services/tv/tv.ts`), and `revalidateTaxonomyPaths()` (`src/lib/services/taxonomy/taxonomy.ts`). Extend these helpers; do not hand-roll tag lists at mutation sites.
- Cache Components (Next.js 16):
  - `cacheComponents: true` enabled in `next.config.mjs`. Cached service reads use `"use cache"`, `cacheTag(...)`, and `cacheLife(...)`.
  - CRITICAL NEXT 16 RULE: `revalidateTag(tag, profile)` requires the EXACT profile object reference from `src/lib/cache/lifetimes.ts` (`LIST_CACHE_LIFE`, `ITEM_CACHE_LIFE`, `WEATHER_CACHE_LIFE`, `HEALTH_CACHE_LIFE`, `IMAGE_CACHE_LIFE`, `REPORT_CACHE_LIFE`, `PROFILE_CACHE_LIFE`, `AUTHZ_CACHE_LIFE`, `SHORT_LINK_CACHE_LIFE`). Inline object literals (e.g. `{ revalidate: 300 }`) do NOT match Next 16 internal identity checks.
- Admin Content Route Error Mapping (`src/lib/api/admin-handler.ts`):
  - `mapMutationErrorResponse` maps typed errors:
    - `isInvalidConcurrencyTokenError` → 400
    - `isStaleRecordError` → 409
    - `isInvalidReferenceError` → 400
    - `UploadValidationError` (`src/lib/storage/errors.ts`) → 400
    - `TimeoutError` or `isConnectionError` (`src/lib/db/client.ts`) → 503 "The ... service is temporarily unavailable"
    - Missing entity prefixes (`notFoundPrefixes`) → 404
    - All other errors → 500 "Internal error" (message logged via `log.error`, never echoed raw to client).
- Deletion Lifecycle & Moderation Detach:
  - Audited deletes: Spot/event/tv deletes share OCC + audit logging via `deleteWithOccAudit` (`src/lib/repositories/core/occ-delete.ts`) which enforces `expectedDate` (If-Match) on `updatedAt` and records to `content_audit_log`.
  - Spot Moderation Detach Plan: Spot hard-deletes additionally call `detachSpotDependents` (`src/lib/repositories/spot/spot-delete-plan.ts`):
    - Lobby games: Hard-deleted (never started).
    - Active games: Cancelled and detached (`spotId: null, spotRemoved: true, status: 'cancelled'`, snapshots preserved).
    - Completed/cancelled games: Detached with display snapshots (`spotId: null, spotRemoved: true`).
    - Challenge records: Snapshot name and slug in place (`spotNameSnapshot`, `spotSlugSnapshot`).
    - Weather reports & location verifications: Deleted (scoped strictly to spot).
    - Cascades handled by DB: `saved_spots`, `verified_spots`, `spot_weather_verifications`, `spot_disciplines`, `spot_type_assignments`.
    - Any new `RESTRICT → spots` foreign key MUST be handled in `detachSpotDependents`; unhandled FK violations surface as 409 by design.
- Concurrency & Read Safety:
  - Global database concurrency gating lives inside `withDbRetry` (`withGlobalDbConcurrency` in `src/lib/db/concurrency.ts`), bounded by `CONCURRENCY_MAX` (capped at `POOL_MAX`). Do not hand-roll per-layout or per-route connection concurrency gating.
  - Displayed spot weather is client-side only via `/api/weather`; per-spot `"use cache"` (`src/lib/weather/weather-cached.ts`) absorbs requests. Do not restore an all-spots weather fetch to SSR/layouts.
- Data Flow, RSC Flight & Egress Guardrails:
  - Supavisor & Egress Model: Runtime database queries ride the Supavisor shared pooler (`:6543`, Transaction mode) under the Supabase 5 GB/mo Unified Egress quota (~160 MB/day).
    - Transaction-Free Reads: Never wrap point reads or read services in `db.transaction(...)`. Always use `withDbRead`. Reads must execute in 1 network RTT on the shared client (`BEGIN`/`COMMIT` wastes 2 extra pooler round trips).
    - Authorization Snapshot: User permission and role checks on read surfaces must use `getAuthorizationSnapshotCached(userId)` (`AUTHZ_CACHE_LIFE`), never fresh sequential queries on hot paths.
  - RSC Flight Wire Slimming: Never serialize raw database schema rows (e.g. 27-column events, 21-column spots, 500 TV cards) across the RSC boundary to Client Components.
    - Always define a minimal UI projection interface (e.g. `MarqueeEventInput`, `MarqueeVideoInput`, `MapSpot`, `SavedSpotHead`) selecting ONLY the fields rendered by the client component.
    - Never attach unused object references or `.raw` back-pointers to client item models.
  - Hierarchical Layout Context Deduping: Descendant layouts (`/map/layout.tsx`, `/tv/layout.tsx`, `/games/layout.tsx`) must NEVER duplicate data fetching or mount duplicate providers already mounted in `RootLayout` (`UserProvider`, `SavedSpotsProvider`, `VerifiedSpotsProvider`, `HydrationGate`).
  - Multiplayer Polling & Realtime Protection:
    - Any high-cadence polling endpoint must implement a transaction-free, single-query version pre-check (returning HTTP `304 Not Modified` with a 0-byte body when `version === knownVersion`) before opening transactions or joining relation graphs.
    - Client polling intervals must stay strictly below proxy rate limits (e.g. 2s cadence = 30 req/min requires tier limit >= 60).
    - Realtime subscribers must ignore signals where `signalVersion <= currentVersion`, and explicit action refreshes must clear pending debounce timers.
  - Terminal State Caching: Terminal entities (`status: complete` or `status: cancelled`) are immutable; their GET route handlers must return `Cache-Control: private, max-age=300, stale-while-revalidate=3600`.

## Database & Migrations

- Connection Resolution:
  - Runtime `getDatabaseUrl()` (`src/lib/config/env.ts`) resolves `SUPABASE_DATABASE_URL` (pgBouncer pooler `:6543`, Transaction mode, required on Vercel) before `SUPABASE_DIRECT_URL` (direct `:5432`, local DDL only).
  - `drizzle.config.ts` uses different precedence: `SUPABASE_DIRECT_URL` (preferred), `DB_CONNECTION_STRING`, `DATABASE_URL`. `DB_CONNETION_STRING` (typo) throws.
  - Pool defaults: `POOL_MAX` (3 in production, 5 in development), `STATEMENT_TIMEOUT_MS` (8,000ms), `CONNECT_TIMEOUT_SECONDS` (5s), `IDLE_TIMEOUT_SECONDS` (5s), `CONNECTION_LIFETIME_SECONDS` (240s — keeps connections safely below pgBouncer's 600s `server_idle_timeout` to prevent 57014 errors).
- Schema & DDL Management:
  - Schema source of truth is `src/db/schema.ts` (re-exports `src/db/schema/index.ts`). Domain barrels `src/db/schema/{auth,games,spots,taxonomy}.ts` provide domain-specific re-exports.
  - Migration generation: `pnpm exec drizzle-kit generate` writes SQL to `supabase/migrations`.
  - Migration applier: `pnpm db:apply` (`src/db/apply-sql.ts`) applies pending migrations under a session-level advisory lock (`hashtextextended('openspot:database-apply', 0)`). Tracks status in `schema_migrations` with normalized statement SHA256 hashes (`detectMigrationDrift`). Legacy ledger hashes self-heal with a `↻` log line. Applied migrations are strictly immutable — semantic fixes must always ship as new migration files.
  - Fresh setups: `pnpm db:fresh` (`pnpm db:reset && pnpm db:apply`); `pnpm db:fresh:seed` adds base seed data, TV fixtures, and trick catalogs.
- Environment Loading in DB Scripts:
  - DB CLI scripts import `src/db/load-env.ts`, which loads `.env.local` with `override: true` before `.env` with `override: false`. `.env.local` always wins over exported shell variables. `.gitignore` excludes `.env*` (only `.env.example` is committed).
- Trick Catalogs:
  - Seeded per discipline via `pnpm db:seed-tricks:<skateboard|bmx|scooter|roller>` (or generic `pnpm db:seed-tricks <discipline>`, `src/db/seed-tricks.ts` → `seedChallengeCatalogForDiscipline` in `src/db/seed-data/challenge-catalogs.ts`).
  - Uses replace + snapshot semantics: JSON fixtures in `src/data/tricks/*.json` are the source of truth. Missing tricks in the fixture are removed on seed.
- Secrets & Credentials:
  - Never expose `SUPABASE_SECRET_KEY` (`sb_secret_...`); only privileged server modules (`getAdminClient()` in `src/lib/auth/auth.ts`, `src/lib/supabase/admin.ts`) may access it.
  - Public browser keys: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - `ADMIN_EMAILS` is bootstrap-only: seed grants the `admin` role to existing `auth.users` rows; runtime authorization uses database roles and permissions (`src/lib/auth/server.ts`).

## Storage & Media Plane

- Provider: Cloudflare R2 is the object plane (`STORAGE_PROVIDER=r2`). `src/lib/supabase/storage.ts` is a deprecated re-export shim.
- Upload processing: Sharp generates 128, 400, and 800 WebP variants at upload (`src/lib/storage/index.ts`).
- Image serving: `unoptimized: true` is configured in `next.config.mjs`. Images are delivered directly from CDN domains (`spots.cdn.openspotleague.com`, `events.cdn.openspotleague.com`). Do not enable Next.js image optimization transforms.
- Validation: Storage upload failures throw `UploadValidationError` (`src/lib/storage/errors.ts`). Routes check `error instanceof UploadValidationError`; never string-match error messages.

## UI Conventions & Styling

- Mobile 16px Rule: Form controls (inputs, selects, textareas) must render at least `16px` on mobile to prevent iOS Safari auto-zoom. Global guard in `src/app/globals.css` (`@media (max-width: 639px)` with `!important`); for new inputs prefer `text-base sm:text-sm`. Never attempt to fix zoom via viewport `maximum-scale` or `user-scalable=no`.
- Design System (`DESIGN.md`):
  - Monochrome system based on Plus Jakarta Sans.
  - `--color-primary` is `#0a0a0a` (pure black, reserved for CTAs, active nav, critical states, wire rail). Never use on dark panels.
  - Hero / marketing gradient (`bg-gradient-primary` or `var(--gradient-primary)` from `#ea580c` via `#dc2626` to `#b91c1c`): The only warm wash, reserved for Home hero and Games landing.
  - Radius: `radius-lg` (16px) or `full` for interactive controls; `14px` (`radius-inner`) only for rows/cards nested inside a 16px parent.
  - Shell chrome (header, nav, mobile drawer) shares a 64px height and unified margin alignment.
- Map Canvas Palette (`DESIGN.md`, `src/app/globals.css`):
  - All maps (`LeafletCanvas`, `SpotStaticMap`, `SpotMapFallback`) use the high-contrast dark palette (`--color-map-*` tokens and `--map-tile-filter` on `.leaflet-tile-pane` / `.map-tile-dark`) STRICTLY for the map canvas, tiles, and on-map markers/overlays.
  - NEVER apply the map dark mode to surrounding page layouts, headers, sidebars, drawers, or cards.
- Performance Standard — Ban on `animate-pulse` in UI Components:
  - `animate-pulse` and continuous pulse animations are strictly prohibited across all user interface components, buttons, badges, status dots, cards, and feature specifications.
  - Rationale: Continuous CSS opacity/scale pulse loops force continuous GPU compositor repaints, thread churn, and battery drain in web browsers. Stopping use is mandatory and non-negotiable.
  - ONLY EXCEPTION: Skeletons and loading components (`*Skeleton.tsx`, `loading.tsx`, Suspense loading fallbacks). These transient components are unmounted once data arrives, so they are the only allowed surface for `animate-pulse`. All other UI must be free of pulse animations.
- Component Structure & Organization:
  - `src/components/games/create/GameCreateForm.tsx`: Helper subcomponents live in `form-parts.tsx` (same directory); trick-catalog filtering and AND-logic live in `trick-catalog-filters.ts` with unit tests.
  - `src/components/games/layout/Header.tsx`: Presentational components in `header-parts.tsx`, pure derived state in `header-state.ts` (tested), and onboarding in `share-onboarding.ts`.
  - TypeScript aliased narrowing: Guard against loss of narrowing across module boundaries by keeping explicit `game &&` checks where JSX dereferences `game`.
- Module Imports & Shims:
  - Import configuration from `@/lib/config/env` and hooks from `@/hooks/data/*`, `@/hooks/map/*`, `@/hooks/preferences/*`, `@/hooks/ui/*` directly.
  - Never import `src/lib/safe-fetch.ts` (deprecated re-export shim); use `@/lib/utils/safe-fetch`.

## Security Headers

- Security/CSP headers are maintained in two places that must be kept in sync:
  1. `next.config.mjs` `headers()`: Static and build-time responses (CSP string duplicated inline because TypeScript cannot be resolved in config).
  2. `src/lib/security/headers.ts` (`securityHeaders` + `cspValue()`): Applied dynamically at runtime by `src/proxy.ts`.
  - TV embed routes (`/tv`, `/tv/*`) get `frame-ancestors *`.

## Specifications & Documentation

- Feature specifications live in `.agents/specs/`:
  - `league/`: `api.spec.md`, `business-rule.new.md`, `data-model.spec.md`, `email.spec.md`, `engine.spec.md`, `plan.league.spec.md`, `ui.spec.md`, `verification.spec.md`.
- Always inspect the relevant specification before modifying league, challenge game, TV, or data catalog implementations.

## Codebase Memory MCP Usage

- Project Identifier: `Users-gabrielalfonso-Development-Personal-Projects-openspotleague`.
- Knowledge Graph Priority: Prefer MCP graph tools over grep/glob for symbol and relationship discovery:
  1. `search_graph`: Find functions, classes, routes, interfaces, and variables by name pattern or query.
  2. `trace_path`: Trace caller/callee paths and cross-service dependencies.
  3. `get_code_snippet`: Retrieve exact function, method, or class source definitions.
  4. `check_index_coverage`: Validate candidate paths and check coverage freshness before making material claims.
  5. `query_graph`: Execute Cypher queries for complex structural or multi-hop relationship patterns.
  6. `get_architecture`: Inspect project-wide architecture, hotspots, and layer boundaries.
