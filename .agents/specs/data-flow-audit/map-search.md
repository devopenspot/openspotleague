# Phase 3 — Map Section & Search Component (`/map`, SearchOverlay)

## Phase 3.1 — Research

### Server reads

- Root layout (`src/app/layout.tsx:138-162`): regions, spot types (cached), auth (→SH1), saved/verified lists (cached, 200 rows each).
- Map layout (`src/app/map/layout.tsx:51-71`): `getCommonDirectoryData()` (`services/spot/directory.ts`) — `"use cache"` `directory:common` — but its content is **`spotRepo.list()` = 500 rows × 21 columns + 2 array_agg aggregates** (~350–600 KB flight), plus regions + types. Also `listEventsForMap(null)` (50 slim events, cached). Then **re-fetches + re-serializes saved/verified lists a second time** (`map/layout.tsx:78-95`).
- Map page (`src/app/map/page.tsx:43-75`): for a filtered country view, `listSpotsForMapScope(country)` — `"use cache"` `spots:list` — **cursor-pages up to 20 × 500 = ~10k full 21-column spot rows** (~3–8 MB raw) into the flight payload; additionally fetches the city slice **in parallel although `citySpots ⊂ countrySpots`** — both ship; dedup is client-side (`unionById`).

### Client behavior (verified healthy)

- Search on `/map` is **local-store filtering** (`SearchOverlay.tsx:88-97,333-345`) — zero server fetches. Off-map search: debounced 250ms `GET /api/spots?q=` with abort + result keying (good).
- Weather default OFF; when ON: 100ms-debounced viewport bounds → missing-ids-only batches of ≤50 → `/api/weather` → 6h per-spot `"use cache"` (`weather-cached.ts`). Good.
- Geolocation: one-shot browser `getCurrentPosition`, no watch. Nearby/city-radius walks: ≤4 pages each, session-cached.
- Saved/verified contexts: zero fetch on mount; mutations only via `/api/saved-spots|/api/verified-spots`.
- No realtime subscriptions on map data.
- localStorage/sessionStorage filter + preserve flags: restore on entry via one cached RSC render — no amplification.

### Findings (ranked)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Country-scope walk ships up to ~10k full spot rows although map + searcher render markers and name/city/type fields | `map/page.tsx:60-73`, `map-country.ts` |
| F2 | `citySpots ⊂ countrySpots` both serialized; union only client-side | `map/page.tsx` parallel fetch |
| F3 | `MapLayout` + `MapProvider` duplicate `RootLayout` + `SpotsProvider`: re-fetches & re-serializes `regions`, `spotTypes`, `initialUser`, `initialSavedSpots`, `initialVerifiedSpots`, and mounts a **second nested `UserProvider`, `SavedSpotsProvider`, `VerifiedSpotsProvider`, and `HydrationGate`** (causing signed-in `/map` loads to fire `GET /api/preferences` twice concurrently) | `layout.tsx:138-176` vs `map/layout.tsx:51-112`, `MapProvider.tsx:97-105`, `HydrationGate.tsx:37-40` |
| F4 | Directory = 500 × 21-col rows; a large slice duplicates the country walk content | `directory.ts`, `spot-query.ts:106-138` |
| F5 | `/api/spot-verifications`: 3 uncached queries per poll while a pin is open, `cache: "no-store"` client fetch, no response caching | `useWeatherVerification.ts:87-89`, route `route.ts:49-53` |
| F6 | Public `/api/spots` unthrottled (tier gated off) | `proxy.ts:53-59` → SH2 |
| F7 | Dead `/api/geocode/country` | → SH4 |

## Phase 3.2 — Plan

**P0 (before any change): consumer field inventory.** Grep every reader of the `Spot` shape in map surfaces (`LeafletCanvas` markers, `MapProvider`/stores, `SearchOverlay` local filter, popup/sidebar, nearby panel) and list the exact consumed fields. The slim type must be a superset of that list. This inventory goes into the PR description; P1 is invalid without it.

| # | Change | Rationale (no feature change) |
|---|--------|-------------------------------|
| P1 | **Slim map-scope projection.** Introduce a `MapSpot` type + `mapSpotSelect()` next to `spot-query.ts` containing exactly the inventoried fields (expected: `id, slug, name, city, citySlug, types, sports, image, location, countryCode/country, verificationCount`). `listSpotsForMapScope` returns `MapSpot[]`; stores accept it. Target: country flight ≈ 10× smaller. | Markers and searchers render identical data; fields dropped were never read |
| P2 | **Single-copy scope data.** Note `map/page.tsx:37-41`: `citySpots` was fetched in parallel as a fallback in case the 20-page `countrySpots` walk degraded to empty under DB deadlines. Once P1 slims `listSpotsForMapScope`, if `countrySpots.length > 0` on the server, `loadCountryScope` returns `citySpots: []` (since `citySpots ⊂ countrySpots` and `MapTab` filters by `citySlug` client-side); `citySpots` is only serialized if `countrySpots` degraded to empty. | Preserves deadline-fallback resilience while eliminating duplicate city rows on the wire in normal operation |
| P3 | **Eliminate duplicate layout reads & nested providers in `MapLayout` / `MapProvider`.** Because `/map` is a descendant of `RootLayout` (`SpotsProvider`), `regions`, `spotTypes`, `UserProvider`, `SavedSpotsProvider`, `VerifiedSpotsProvider`, and `HydrationGate` are already mounted above `MapLayout`. Have `MapLayout` fetch only the map spot working set + `listEventsForMap(null)`, and remove the redundant `UserProvider`, `SavedSpotsProvider`, `VerifiedSpotsProvider`, and `HydrationGate` wrappers from `MapProvider.tsx` (matching its existing `WeatherProvider` omission at `MapProvider.tsx:83-89`). Also eliminates the duplicate `GET /api/preferences` call on `/map`. | One copy in flight, one `HydrationGate` mount; identical context and store state |
| P4 | **Saved-spots slimming** — same change as `landing.md` P4 (head rows `{ userId, spotId, createdAt }` in `RootLayout`; `/map?mode=saved` in `MapTab.tsx:285` only reads `savedIds.has(s.id)`). | Heart/verified/saved-map UI only reads `spotId`s |
| P5 | **Directory trim (optional, measure first).** If P1 lands and the directory slice still dominates flight, project `getCommonDirectoryData()`'s spot list through `mapSpotSelect` too (it feeds the same stores). | Same consumers |
| P6 | **`/api/spot-verifications`:** collapse the 3 queries into ≤2 (count + summary can share one round trip via a single service read), add `Cache-Control: private, max-age=15` (popup-level data; still polls at its current cadence but absorbs bursts). Keep the client polling interval unchanged. | Same values shown; marginally staler by ≤15s only across rapid re-opens |
| P7 | Apply SH2 (enable public tier) — `/api/spots` is the biggest scraper surface. SH4 removes the dead geocode route. | Cross-cutting |

## Phase 3.3 — Validation

1. Gates: lint/typecheck/test green; add/extend unit tests for `mapSpotSelect` projection and the city-subset derivation (pure functions).
2. Parity: `/map` default, region/country/city filter commit, nearby mode, weather toggle ON, search overlay on/off map — identical rendering (markers, counts, hearts, popups) before/after. SearchOverlay test "keeps the map route on the local dataset (no server fetch)" still passes.
3. Payload: measure flight bytes for `/map?country=…` before/after (target: from MBs to ~hundreds of KB); `/map` base render shrink per P5.
4. Query log: country walk query returns fewer columns (same row count); no new queries per pan/zoom; spot-verifications route ≤2 queries per call.
5. Stress: rapid filter commits produce no unbounded fetches (debounce/commit behavior unchanged).
