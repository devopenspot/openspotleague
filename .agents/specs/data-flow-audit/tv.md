# Phase 2 — TV Section (`/tv`, `/api/tv*`)

## Phase 2.1 — Research

### Architecture facts (verified healthy)

- TV videos are **YouTube embeds only** — no R2/Storage video, no signed URLs, no HLS. Media egress is browser → `youtube.com` / `i.ytimg.com`, off-app.
- **No polling, SSE, router.refresh, or meta refresh anywhere on public TV.** Theater auto-advance is client-side YouTube `postMessage` (`TvPlayerModal.tsx`). Only timers are UI safety/animation (8s, 200ms, 1s debounce).
- **Dialog URL sync (`?play=`, `?thumb=`, `?title=`) uses `window.history.replaceState` + `popstate` listener (`TvGrid.tsx`)** instead of `router.replace`, preventing Next.js App Router RSC payload refetches on modal open/close/next/prev/auto-advance.
- Proxy touches no DB; TV paths are cookie-free (`needsSeedForPath` excludes `/tv`, `src/proxy.ts:30-32`), anonymous viewers short-circuit before any Supabase call (`proxy.ts:151`), and TV gets `frame-ancestors *` (`proxy.ts:73-78`, mirrored in `next.config.mjs`).
- Public projections are slim (`tvCardColumns()`), bounded (pages ≤50, id list ≤500), no `SELECT *`, backed by partial composite keyset indexes (`tv_videos_published_keyset_idx`, `tv_videos_published_discipline_keyset_idx` in `0041_tv_videos_keyset_indexes.sql`).

### Reads on `/tv` (`src/app/tv/page.tsx`)

| Read | Cache | Notes |
|------|-------|-------|
| `listSports()` | `"use cache"` `sports:all` LIST | cached |
| `getSessionUser()` | uncached | skipped entirely when `?discipline=` (incl. `all`) is present; → SH1 |
| `getPreferences(userId)` (signed-in, no `?discipline=`) | uncached | single `withDbRead` SELECT (SH3 applied) |
| `listTvCategoryRows(discipline)` | `"use cache"` `tv:list` | cold miss = **1 single windowed query** (`repository.listCategoryRows` via `ROW_NUMBER() OVER` + `unnest(categories)`); steady state free |
| `findTvCardById(playId)` in `generateMetadata` + `TvPage` (`initialPlayVideo`) | `"use cache"` `tv:item:<id>` | only with `?play=`/`?v=`; shared cache entry eliminates client-side `GET /api/tv?id=` waterfall on shared links |

### API routes

`GET /api/tv` (`?id=` / `?ids=` max 10 / `?limit=&cursor=` ≤50) and `GET /api/tv/ids` route through the **`"use cache"` service variants** (`listTvCardPage`, `findTvCardById`, `findTvCardsByIds`, `listTvIdList` in `src/lib/services/tv/tv.ts`) with normalized cache keys (`tv:list` / `tv:item:<id>`) behind `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`. UUID validation guards `?id=` and `?ids=` at both route and service boundaries to prevent Postgres `22P02` cast errors.

### Findings

| # | Finding | Evidence |
|---|---------|----------|
| F1 | `/api/tv` routes use `"use cache"` variants + `s-maxage=300, swr=600` (double-shielded Data Cache + CDN) | `api/tv/route.ts`, `api/tv/ids/route.ts`, `services/tv/tv.ts` |
| F2 | Preferences read unwrapped from transaction + auth snapshot cached (skipped on `/tv` when `?discipline=` is set) | `preferences.ts:52-58`, `auth.ts:91`, `tv/page.tsx:147` → SH1/SH3 |
| F3 | Landing serializes the whole TV catalog | owned by `landing.md` P3 (D2: slim `MarqueeVideoInput` shape, keep count) |
| F4 | Admin surfaces (`/admin/tv`, `/api/admin/tv`) reuse authenticated user from `requireTvCurationAccess`, use `getAuthorizationSnapshotCached` (SH1), and push scoped curator discipline filtering into SQL (`disciplineSlugs`) | `admin/tv/page.tsx`, `api/admin/tv/route.ts`, `drizzle-tv-repository.ts` |
| F5 | Cold-miss category rows collapsed from $1 + N$ queries into 1 windowed SQL query + unused `countTvByDiscipline` removed from `/tv` SSR | `drizzle-tv-repository.ts:listCategoryRows`, `tv/page.tsx` |
| F6 | Theater playback URL sync uses `window.history.replaceState` instead of `router.replace`, eliminating client RSC refetch storms | `TvGrid.tsx` |

## Phase 2.2 — Plan

| # | Change | Rationale (no feature change) |
|---|--------|-------------------------------|
| P1 | Route `/api/tv` + `/api/tv/ids` handlers through normalized `"use cache"` variants (`listTvCardPage`, `findTvCardById`, `findTvCardsByIds`, `listTvIdList`, tag `tv:list` / `tv:item:<id>`) with outer `s-maxage=300, stale-while-revalidate=600` headers and UUID boundary guards. | Identical responses; pooler double-shielded (Data Cache + CDN) |
| P2 | Apply SH1 (authz snapshot cache) and SH3 (preferences tx unwrap); skip session/preferences lookup on `/tv` when `?discipline=` is explicit; pre-populate `initialPlayVideo` on SSR for `?play=` links. | Cross-cutting + eliminates redundant SSR & client waterfall reads |
| P3 | Collapse `listTvCategoryRows` cold miss into a single windowed query (`listCategoryRows`) backed by partial composite keyset indexes (`0041_tv_videos_keyset_indexes.sql`), and remove unused `countTvByDiscipline` from `/tv` SSR. | 1 pooler query on cold miss instead of $1 + N$; smaller RSC flight |
| P4 | Use `window.history.replaceState` + `popstate` for theater modal `?play=` URL sync and isolate per-category appended state (`useTvCatalogState`). | Zero server RSC refetches during video playback/auto-advance; preserves multi-category keyset cursors |

## Phase 2.3 — Validation

1. Gates: lint/typecheck/test green; all 87 TV repository, service, API, and component tests pass.
2. Parity: `/tv`, `?discipline=`, `?play=` deep link, theater boundary walk (`/api/tv/ids` then `/api/tv?ids=`) behave identically; response bodies byte-comparable before/after.
3. Cache behavior: second `/api/tv?limit=12&category=…` request hits Data Cache + CDN, not the pooler; theater navigation triggers zero RSC fetches.
4. Query log: `/tv` cold-miss category load runs 1 SQL query; signed-in render uses cached authz + bare preferences read (0 queries when `?discipline=` is in URL).
