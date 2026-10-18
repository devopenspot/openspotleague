# Phase 1 — Landing Page (`/`)

## Phase 1.1 — Research

### Server render chain

`HomeContent` (`src/app/page.tsx:37-75`): `connection()` + `cookies()` → per-request render, no CDN cache. Fan-out of 3 reads, each in `withSafeDefault`:

| Read | Service | Cache | Query |
|------|---------|-------|-------|
| `listSpotCards({limit:12, random:true, seed, hasImage:true})` `page.tsx:44` | `services/spot/spots.ts` | `"use cache"` `spots:list` LIST profile | cached ID-scan + 12 slim card rows |
| `listEvents({limit:12, random:true, seed})` `page.tsx:49` | `services/event/events.ts` | `"use cache"` `events:list` LIST profile | cached ID-scan (all rows, no visibility filter — see F2) + **12 rows × 27 columns** via `selectJoined` (`drizzle-event-repository.ts:172-214`) |
| `listTvCards({publishedOnly:true})` `page.tsx:54` | `services/tv/tv.ts:43` | `"use cache"` `tv:list` LIST profile | slim `tvCardColumns()`, **limit defaults to 500** (`drizzle-tv-repository.ts`) |

Root layout (`src/app/layout.tsx:138-162`): `listRegions()` + `listSpotTypes()` (both cached), `getServerUserFromCookies()` (uncached → SH1), and for signed-in users `listSavedSpotsForUser(id, {limit:200})` (cached, hydrates **200 full spot rows**, `drizzle-saved-spots-repository.ts`) + `listVerifiedSpotsForUser` (cheap 3-col).

### Flight payload (the actual waste)

`page.tsx:65-72` passes raw objects to the client `LandingMarquee`, which derives marquee items client-side (`LandingMarquee.tsx:198` → `toMarqueeItems`):

- **Events:** full 27-column `SportEventEnriched` rows serialize into flight. The wire (`buildEventItem`, `marquee-data.ts:76-88`) consumes only `id, name, image, slug, dateRangeLabel, sports`. `dateRangeLabel` derives from `startAt/endAt` (`events.ts:65`).
- **TV:** up to 500 slim `TvCard` rows serialize; wire consumes `id, title, youtubeUrl, category, postDate, disciplineSlug` (`buildVideoItem`, `marquee-data.ts:90-107`). All 500 render in the marquee (round-robin interleave over the longest bucket), so count must stay — per D2 only the per-row shape can shrink.
- **`raw` refs:** `MarqueeItem.raw` (`marquee-data.ts:20-23`) re-embeds the source object; **no consumer reads `.raw`** (grep verified). Dead serialization weight.
- Spots already use the slim `SpotCard` projection — nothing to do.

### Client fetches

- `LandingMarquee.tsx:87-166`: IntersectionObserver pagination → `GET /api/spots|/api/events?limit=12&random=true&seed=…&cursor=…` (no timers). Routes set `s-maxage=60, swr=300`; seed embeds make CDN keys per-visitor (accepted cost — randomness is the feature).
- `HydrationGate` (signed-in only): `GET /api/preferences`, once per mount.
- No polling, no weather on landing.

### Findings (ranked)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Full event objects (27 cols incl. `description`) in flight for cards rendering 6 fields | `page.tsx:67`, `selectJoined` |
| F2 | Event shuffle pool has **no visibility/status guard** → unlisted events can surface publicly | `shuffleFilterConditions`, `drizzle-event-repository.ts:221-250` (spot-side mirror has the guard) |
| F3 | ≤500 TV cards serialize with derived `embedUrl` (7 fields) although `buildVideoItem` only reads 6 fields | `page.tsx:54`, `toTvCard()` (`drizzle-tv-repository.ts:47-61`) |
| F4 | `MarqueeItem.raw` dead weight | `marquee-data.ts:20-23` |
| F5 | `runListRegions` read inside `db.transaction` | `regions.ts:17-29` → SH3 |
| F6 | Authorization snapshot per render | `auth.ts:91` → SH1 |
| F7 | Saved-spots hydration in `RootLayout`: 200 full 21-col spot rows serialized on every route, although only `/saved` (`SavedTab.tsx:29-33`) reads `.spot` | `drizzle-saved-spots-repository.ts`, `layout.tsx:148-154` |

## Phase 1.2 — Plan

| # | Change | Rationale (no feature change) |
|---|--------|-------------------------------|
| P1 | **Slim the event wire.** Add `MarqueeEventInput` minimal interface (`id, name, image, slug, dateRangeLabel, sports`) mirroring the `MarqueeSpotInput` structural pattern. Project events to this shape server-side in `HomeContent` (one `map`) before passing to `LandingMarquee`, and do the same in `GET /api/events` (grep-verified: `LandingMarquee.tsx:121` is the only runtime caller of `/api/events`). `SportEventEnriched` satisfies the interface structurally, so `buildEventItem` needs only its signature narrowed. | Identical rendered marquee; only unsent columns (`description`, `address`, `instagram`, audit cols…) stop crossing the wire |
| P2 | **Fix event shuffle visibility (D3, bugfix).** Add `eq(sportEvents.visibility, "public")` to `shuffleFilterConditions` (matching `DrizzleEventRepository.list` at `drizzle-event-repository.ts:286`) and to `listByIds`. | Same fix pattern as spots; unlisted community events were never meant to be public |
| P3 | **Trim landing TV card wire.** `tvCardColumns()` already selects only the 6 DB columns (`id, title, youtubeUrl, disciplineSlug, category, postDate`), but `toTvCard()` attaches `embedUrl`, which `buildVideoItem` (`marquee-data.ts:90-107`) never reads (it builds thumbnails from `youtubeUrl`). Strip `embedUrl` on the landing projection (or narrow `MarqueeVideoInput` to the 6 fields, saving ~30 KB across 500 cards). Keep 500-card count. | D2: count preserved; row shape equals exactly what renders |
| P4 | **Saved-spots slimming (consumer inventory verified).** Grep of `useInitialSavedSpots` confirmed only two readers: `useSavedSpots.ts:120` (reads `spotId` only) and `SavedTab.tsx:29-33` on `/saved` (reads `.spot` for `SavedSpotCard`). Switch `RootLayout`'s `initialSavedSpots` to the head-row pattern (`{ userId, spotId, createdAt }`, matching `initialVerifiedSpots`) and have `SavedTab.tsx` load full saved spots via a `useSavedSpotList` hook on `/saved` (mirroring `useVerifiedSpotList.ts` against `GET /api/saved-spots`). | Heart UI is unaffected app-wide; `/saved` keeps full card details without taxing every other route's RSC flight |
| P5 | **Remove `MarqueeItem.raw`** (and its `raw?: spot/event` assignments). | No reader; Flight already dedupes same-instance refs but the field invites future accidental serialization |
| P6 | Apply SH1 (authz cache), SH3 (regions tx unwrap). | Cross-cutting |

## Phase 1.3 — Validation

1. Gates: lint/typecheck/test green; marquee unit tests (`marquee-data`, `interleave`, `filterByDiscipline`) untouched and passing; add a test pinning `MarqueeEventInput` projection fields.
2. Parity: dev-render `/` before/after — identical marquee order for a fixed seed, identical cards; event cards still show name/image/date/discipline filters.
3. Bugfix check (P2): with an unlisted event in DB, it no longer appears in the landing shuffle; listed events unchanged.
4. Payload: measure RSC flight for `/` before/after (target: event row payload ≈ 6 fields × 12; TV row ≈ 6 fields × 500; no `raw`).
5. Query log: no new queries on `/`; P2 adds predicates to an existing cached query; regions read loses 2 RTT.
