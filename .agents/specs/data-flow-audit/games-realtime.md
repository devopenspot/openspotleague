# Phase 4 — Games Section, Real-Time Features (`/games`, `/api/games`)

## Phase 4.1 — Research

### Real-time mechanism

`src/lib/games/realtime.ts` — Supabase Realtime channel `game:<id>` on `postgres_changes` (`game_realtime_signals`, filter `game_id`), signal → 75ms-debounced full-state refetch. Fallback polling:

- `POLL_INITIAL_DELAY_MS = 2_000`, doubles to 30s **only on failure**, resets to 2s on success (`realtime.ts:75-77,109-131`).
- **Guests always poll** (`useChannel: false` → `pollingFallback = true`, `realtime.ts:157-159`).
- Visibility pause/resume; resume triggers an immediate full GET.
- League mirrors the same constants (`src/lib/league/realtime.ts:16-18`).

### Cost per poll (the dominant steady-state pooler traffic)

`GET /api/games/[id]` (`route.ts:5-43`) → `resolveIdentity` (auth `getClaims` + **uncached authz snapshot** for signed-in users → SH1) → `getGameState` (`services/games/index.ts:2195-2356`).

- `useGameRealtime.ts:94` already passes `?version=${latestGameRef.current?.version}` on every poll, and `getGameState` (`services/games/index.ts:2200-2201`) already short-circuits to `null` (HTTP `304`, 0-byte body) **before** the ~8 child queries (`players`, `rounds`, `laps`, `attempts`, `scores`, `verifications`, `stats`, `catalog`) when `game.version === knownVersion`.
- However, **every 304 poll still pays 4 pooler round trips inside `getGameState`** (+ 5 RTTs in `getAuthorizationSnapshot` when signed in):
  1. `database.transaction(..., { isolationLevel: "repeatable read", accessMode: "read only" })` opens `BEGIN` and closes `COMMIT` (2 RTTs) around the version check.
  2. `loadAuthorizedGame` (`services/games/index.ts:2110-2132`) runs 2 sequential queries (`SELECT * FROM game_sessions` + `SELECT id FROM game_players`) even when the version hasn't changed.
- **Rate-limit boundary bug:** Guest/degraded cadence = 1 poll every 2s per visible tab = **30 req/min** — right on the `/api/games` proxy tier (`30/min/IP`, `proxy.ts:42`), so any action or retry during polling brushes HTTP `429`s today.

### Write path & amplification (verified healthy core)

Mutations: `withDbWrite` + `db.transaction` + `FOR UPDATE` OCC + idempotent `game_action_requests` insert + signal row; RETURNING is narrow; mutation responses are tiny. No N+1 on participants. Issues:

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Every 2s `304` poll opens a `REPEATABLE READ` tx + runs 2 sequential queries in `loadAuthorizedGame` (4 RTTs + 5 authz RTTs if signed in) and hits the 30/min rate-limit ceiling | `realtime.ts:75,109-131`, `services/games/index.ts:2110-2132,2198-2201`, `proxy.ts:42` |
| F2 | Full-state loads (when version changes) run inside `getGameState` after `loadAuthorizedGame` already selected `*` from `game_sessions` | `services/games/index.ts:2198-2201` |
| F3 | Post-action duplicate GET: `useGameRealtime.ts:64-69` already calls `controller.refresh()`, but `createRefreshCoordinator.refresh()` (`realtime.ts:37-60`) does not clear a pending `refreshTimer` from `schedule()`, and the Realtime handler (`realtime.ts:168`) schedules a refetch even when `payload.new.version <= current.version` | `realtime.ts:37-69,168`, `useGameRealtime.ts:64-69` |
| F4 | Terminal games (`complete`/`cancelled`) are immutable, but `GET /api/games/[id]` always sends `Cache-Control: private, no-cache`, forcing full DB reloads when viewing results from `MatchList` (`useAwardHistory.ts:41-45`). Note: `/api/games/[id]/history` omits `players` and session metadata needed by `AwardDialog` and runs the same 6 queries, so caching terminal `getGameState` responses is strictly better | `api/games/[id]/route.ts:36`, `useAwardHistory.ts:41-45`, `award-result.ts:43-113` |
| F5 | `getGameCreationOptions` (`services/games/index.ts:363-413`) runs an uncached `db.transaction` (catalog + spotTypes) and is called by both `GET /api/games/options` and server-side `findNearbyChallengeSpot` (`:420`) | `api/games/options/route.ts:15`, `services/games/index.ts:363-428` |
| F6 | Abandoned challenge games (`lobby`/`active`) are never swept — blocking users with `"You already have an open game"` (`services/games/index.ts:1121`) and leaving ephemeral `game_realtime_signals` rows forever | `cancelExpiredTrainingGames` (`services/games/index.ts:273-307,1093,1107-1122`) |
| F7 | `listGamesForUser` selects all created+joined ids before paging | `services/games/index.ts:2669-2700` — lightweight rows; **documented, no change** |
| F8 | Authz snapshot per GET | → SH1 |
| F9 | `fetchWithTransportRetry` duplicates POSTs on network error | safe by idempotency design; **no change** |

## Phase 4.2 — Plan

| # | Change | Rationale (no feature change) |
|---|--------|-------------------------------|
| G1 | **Single-query transaction-free 304 pre-check (D4).** When `knownVersion !== undefined` in `getGameState` (`services/games/index.ts:2195`), run a single transaction-free query (selecting `version, mode, status, shareCode, createdBy` + `EXISTS(SELECT 1 FROM game_players ...)` for membership) **before** opening the `REPEATABLE READ` transaction. Verify access via the exact same rules as `loadAuthorizedGame`; if `game.version === knownVersion`, return `null` (`304 Not Modified`) immediately in **1 pooler query** (down from 4 RTTs, and 0 extra HTTP round trips when the version *does* change). Apply the same pattern to league if applicable. | Keeps 1-RTT full-state response on turn change and cuts unchanged 2s polls to 1 bare query + 0-byte `304` |
| G2 | **Raise `/api/games` proxy rate limit.** In `src/proxy.ts:42`, bump `/api/games` from `30` to `60` req/min/IP (matching `/api/league` at `60/min/IP` on line 43). | Eliminates the 30/min boundary collision where 2s polling (30/min) + player actions trigger false-positive 429s |
| G3 | **Eliminate post-action duplicate GET.** In `createRefreshCoordinator` (`src/lib/games/realtime.ts:37-60`), clear any pending `refreshTimer` at the start of `refresh()` so an explicit action refresh cancels a queued 75ms debounce. In `subscribeToGame` (`realtime.ts:168`), inspect the `postgres_changes` payload and skip `scheduleRefresh()` when `typeof payload?.new?.version === "number" && current && payload.new.version <= current.version`. Mirror in `src/lib/league/realtime.ts`. | Same final state on screen; action-refresh + signal-refresh collapse into 1 GET (and 0 redundant 304s) |
| G4 | **Cache immutable terminal game state.** In `GET /api/games/[id]` (`src/app/api/games/[id]/route.ts:34-39`), when `state.status === "complete" || state.status === "cancelled"`, return `Cache-Control: private, max-age=300, stale-while-revalidate=3600` (and in `useAwardHistory.ts:42`, drop `cache: "no-store"` so repeated opens in `MatchList` use browser cache / `If-None-Match`). | Completed/cancelled games never mutate; `AwardDialog` keeps all required `GameState` + `players` fields |
| G5 | **Cache `getGameCreationOptions` & unwrap transaction.** Wrap `getGameCreationOptions` (`services/games/index.ts:363`) in `"use cache"` with `cacheTag("trick-catalogs:current")`, `cacheTag(\`games:catalog:${discipline}\`)` (already invalidated by `revalidateTrickCatalog` in `trick-catalogs.ts:21-22`), and `cacheTag("spot-types:all")` (invalidated in `taxonomy.ts:45`), `cacheLife(LIST_CACHE_LIFE)`. Replace its internal `db.transaction` with `Promise.all` under `withDbRead`. | Identical options data; shields both `GET /api/games/options` and server-side `findNearbyChallengeSpot` |
| G6 | **Grace-aware challenge-game GC & signal cleanup (D5).** Add `cancelExpiredChallengeGames` alongside `cancelExpiredTrainingGames` (`services/games/index.ts:273-307`), invoked on the challenge create path (`:1107`) before the open-game check: (a) for `lobby` challenge games, expire only after `coalesce(scheduledStartAt, updatedAt) + START_GRACE_MINUTES (15m) < now` so scheduled lobbies within their 15-min grace window are never prematurely cancelled; (b) for `active` challenge games, expire after `updatedAt < now - CHALLENGE_GAME_INACTIVITY_MS` (60 min); (c) in both training and challenge sweeps (and terminal transitions), `DELETE FROM game_realtime_signals WHERE game_id IN (...)` since `UPDATE game_sessions SET status = 'cancelled'` does not trigger `ON DELETE CASCADE` and signals are ephemeral wake-ups. | Unblocks players stuck with abandoned open challenge games, preserves the 15-min scheduled start grace window, and bounds `game_realtime_signals` table growth |
| G7 | Apply SH1 — removes the 5-RTT authz tx from every signed-in poll and render. | Cross-cutting |

## Phase 4.3 — Validation

1. Gates: lint/typecheck/test green; `src/lib/games/*` engine tests untouched and passing; new unit tests for: single-query 304 pre-check access predicate, `createRefreshCoordinator` timer cancellation + version-gated signal handler, and grace-aware challenge GC window.
2. Parity (manual script):
   - Guest plays a game: state updates arrive ≤2s; unchanged polls return `304` in 1 query; actions apply with identical OCC/idempotency behavior and no 429s.
   - Signed-in user with live channel: post-action refresh produces 1 request instead of 2.
   - Kill the channel (degraded): fallback resumes as today.
   - Tab hidden/visible: same pause/resume semantics.
   - Award modal in `MatchList` shows identical results and re-opens from cache without hitting the pooler.
3. Egress & query log measurement:
   - Unchanged poll (`GET /api/games/[id]?version=<current>`): 1 pooler query (0 tx `BEGIN`/`COMMIT`, cached authz) + 0-byte `304` body.
   - Every mutation produces ≤1 state refetch.
4. GC: create an abandoned challenge lobby past `scheduledStartAt + 15m` and an active challenge game within its grace window; run sweep; assert only the expired game is cancelled, its `game_realtime_signals` rows are purged, and the valid lobby is untouched.
