# Data-Flow & Resource Audit — Overview

Audits the OpenSpot data flow to cut resource consumption on the Vercel Hobby + Supabase Free tiers without changing any feature. All findings verified against code on 2026-10-16. Existing feature specs (`.agents/specs/<feature>/`) were treated as untrusted; every claim here was re-derived from source.

## Scope & non-goals

- **In scope:** architecture, data flow, cache techniques, pooling, retrieval patterns. Dead-code removal where it reduces attack surface or cost.
- **Out of scope:** any feature/UX change. Where a fix touches visible behavior it is marked as a bugfix and listed in the decision log.

## The egress model (why this audit matters)

Every Drizzle read/write rides `SUPABASE_DATABASE_URL` → **Supavisor shared pooler `:6543`** (`src/lib/config/env.ts`, `src/lib/db/client.ts`). Per Supabase docs that traffic bills as **Shared Pooler Egress** — the 5 GB/mo unified free quota ≈ **160 MB/day**. Secondary buckets: Auth (supabase-js `getClaims`), Realtime (`postgres_changes` messages), Storage (unused — images/videos are R2/YouTube, fetched browser-side).

Vercel side (Hobby): Fast Data Transfer, function invocations, Data Cache. CDN `s-maxage` on API routes already shields most hot GETs; the remaining cost is cache-miss pooler traffic and RSC flight payload size.

References:
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://vercel.com/docs/pricing/manage-and-optimize-usage

## Hard constraints

1. No feature changes. Rendered output and interaction latency must remain equivalent; each change carries a no-feature-change rationale.
2. Keep the existing layering: pages/routes → services → repositories → Drizzle. Never import Drizzle above services.
3. Mutations keep `withDbWrite` + `db.transaction` + OCC + idempotent fingerprint. Reads stay transaction-free at the repository path (BEGIN/COMMIT costs 2 extra pooler round trips).
4. New caches: `"use cache"` + `cacheTag` + `cacheLife` with profile objects from `src/lib/cache/lifetimes.ts`; invalidation via the existing deferred queue (`queueTagRevalidate`), never inside a transaction.
5. No new dependencies. No new tech debt: each phase removes at least one bad practice.

## Decision log (user-approved 2026-10-16)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Spec location | `.agents/specs/data-flow-audit/` (this folder) |
| D2 | Landing TV marquee ships ≤500 cards | Slim what serializes; keep all cards rendered |
| D3 | Event shuffle pool leaks unlisted events on landing | Fix visibility guard (bugfix) |
| D4 | Guest/degraded game polling at 2s | Single-query tx-free 304 pre-check + 60/min rate limit; keep 2s cadence |
| D5 | Abandoned challenge games never GC'd | Include bounded grace-aware cleanup + ephemeral signal purge |

## Cross-cutting fixes (applied once, referenced by all sections)

### SH1 — Cache the authorization snapshot & unwrap its transaction (highest ROI)

`getAuthorizationSnapshot` (`src/lib/services/profile/authorization.ts:143`) currently runs an uncached `db.transaction` with 3 sequential `SELECT`s (roles⋈permissions, country scopes, discipline scopes) = 5 pooler round trips on **every signed-in request** — every page render and every `/api/games` GET (`getServerUserFromCookies` → `src/lib/auth/auth.ts:91`).

Plan:
1. Unwrap `db.transaction` inside `getAuthorizationSnapshot` and run the 3 `SELECT`s in parallel via `Promise.all` under `withDbRead` (5 sequential RTTs → 1 parallel read batch on cold miss).
2. Because `AuthorizationSnapshot` exposes four `ReadonlySet<string>` fields (`roles`, `permissions`, `countryScopes`, `disciplineScopes`), cache the plain serializable row/array data inside `"use cache"` and reconstruct the `Set`s via `snapshotFromRows` outside the cache boundary so `.has()` is guaranteed across cache serialization:

```ts
async function fetchAuthorizationRowsCached(userId: string) {
  "use cache";
  cacheTag(`authz:user:${userId}`);
  cacheLife(AUTHZ_CACHE_LIFE); // short profile, 60s — add to lifetimes.ts
  return fetchAuthorizationRows(userId); // plain arrays: { rows, countries, disciplines }
}

export async function getAuthorizationSnapshotCached(userId: string): Promise<AuthorizationSnapshot> {
  const { rows, countries, disciplines } = await fetchAuthorizationRowsCached(userId);
  return snapshotFromRows(rows, { countries, disciplines });
}
```

- Route `getServerUserFromCookies` (`src/lib/auth/auth.ts:91`) and read-only `userHasPermission` through `getAuthorizationSnapshotCached`. Keep write-guard `require*ForUser` helpers on fresh reads (or route through cached with immediate tag invalidation).
- Invalidate via `queueTagRevalidate(\`authz:user:${userId}\`, AUTHZ_CACHE_LIFE)` in `replaceUserRoles` (`src/lib/services/admin/admin-users.ts`) and `replaceCuratorScopes` (`src/lib/services/admin/curator-scopes.ts`).
- Security note (document in code): permission revocation on read surfaces takes effect within ≤60s (immediate on same-instance invalidation). Acceptable for a curation-permission snapshot.

### SH2 — Enable the public rate-limit tier

The `public-read` tier for `/api/spots`, `/api/events`, `/api/geocode` is gated behind `RATE_LIMIT_PUBLIC_ENABLED` and off by default (`src/proxy.ts:53-59`) — search/nearby endpoints are currently unthrottled per IP. Enable the env var in Vercel project settings (config-only, no code change). In-memory limiter cost is negligible.

### SH3 — Stop wrapping point reads in transactions

- `runListRegions` (`src/lib/services/spot/regions.ts:17-29`): plain SELECT wrapped in `db.transaction` → 3 RTT instead of 1.
- `getPreferences` (`src/lib/services/profile/preferences.ts:54-58`): single SELECT wrapped in `db.transaction`.
- `getAuthorizationSnapshot` (`src/lib/services/profile/authorization.ts:149-172`): 3 read SELECTs wrapped in `db.transaction` (covered in SH1).
- Fix: use the bare `withDbRead` query path (repository-layer pattern, see comment in `src/lib/repositories/index.ts`). Writes keep their transactions.

### SH4 — Remove dead geocode route

`GET /api/geocode/country` has zero callers in `src/` (route + tests only). It performs uncached external Nominatim calls behind an auth check — pure attack surface and egress for no feature. Delete route + tests.

## Execution order

| Phase | File | Risk | Egress impact |
|-------|------|------|---------------|
| 0 | Cross-cutting SH1–SH4 (this file) | Low | Every signed-in request |
| 1 | `landing.md` | Low | Every landing render |
| 2 | `tv.md` | Low | CDN-miss TV traffic |
| 3 | `map-search.md` | Medium | Largest payloads (~MBs per country view) |
| 4 | `games-realtime.md` | Medium-High | Highest steady-state cost (polling) |

Each phase ships and validates independently; SH1 lands first because every later phase benefits.

## Global validation gates (every phase)

1. `pnpm lint && pnpm typecheck && pnpm test` green.
2. Rendered-output parity: same DOM-relevant props/data on the affected surfaces (side-by-side dev comparison before/after).
3. Payload measurement: response/flight byte size captured before and after (dev network tab or `curl -w %{size_download}`); recorded in the phase file.
4. Query count: dev query log confirms no new DB queries on hot paths and a net reduction where claimed.
5. No DB writes added to hot read paths.
