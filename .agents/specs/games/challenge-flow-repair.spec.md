# Challenge Game Flow: Current-State Specification

Describes the behavior of the challenge game flow (`GameCreateForm`, `GameBoard`, `ChallengeGameBoard`, game schemas) **exactly as implemented in the current code**. Nothing here prescribes a change: features, behavior, and UX/UI are documented as-is. Section 4 lists known edge-case behaviors that exist today, so later work can decide on them deliberately. This file replaces the earlier "repair" spec, whose fixes were never applied.

Line references are to the current code and will drift. Re-verify them before relying on them.

---

## 1. Scope & Layering

| Layer | Location | Role |
|---|---|---|
| Domain engine (pure) | `src/lib/games/*` | State machines, scoring, capabilities, board model. No DB/IO. |
| Service orchestration | `src/lib/services/games/index.ts` | Only writer. Authorizes access, validates share codes, persists. |
| Input/output schemas | `src/lib/schemas/game.ts` | Zod request/response contracts. |
| API routes | `src/app/api/games/**` | Route handlers. `[id]/join`, `start`, `cancel`, `leave`, `train-alone`, `rounds/[roundId]/*`, etc. |
| Pages | `src/app/games/**` | `[id]/page.tsx`, `join/[shareCode]/page.tsx`. |
| UI | `src/components/games/**` | `board/GameBoard.tsx`, `board/ChallengeGameBoard.tsx`, `create/GameCreateForm.tsx`, hooks. |

---

## 2. Current Behavior by Area

### 2.1 Route page (`src/app/games/[id]/page.tsx`)
- `GamePage` is an async server component. Its signature types `params: Promise<{ id: string }>` and `searchParams: Promise<{ share?: string }>`.
- The body awaits **only** `searchParams` (`const { share } = await searchParams`) and `getSessionUser()`. `params` is declared but not read.
- It renders `<GameBoard userId={user?.id ?? null} shareCode={share} />`. No `gameId` prop is passed.
- `params` is awaited in `generateMetadata` (same file), not in `GamePage`.

### 2.2 `GameBoard` props and game id
- Props: `{ userId: string | null; shareCode?: string }` (`GameBoard.tsx:22-28`).
- The game id comes from client-side `useParams<{ id: string }>()` (`GameBoard.tsx:29`). It is used as `params.id` for `useGameRealtime` (`:41`) and `useGameAction` (`:43`).
- `useGameRealtime(id, shareCode?, { authenticated })` receives the URL `share` value, which is `undefined` when absent (`useGameRealtime.ts:37`).

### 2.3 Lobby join
- Two entry points call `action("/join", { shareCode })`, with `shareCode` being the raw prop (the URL `?share=` value):
  - `submitGuestJoin` (`GameBoard.tsx:299-309`): trims and validates the guest name through `normalizeGuestName`. An empty name shows "Pick a Name — 1 to 30 Characters." and returns. Otherwise it saves the name in `sessionStorage["openspot-guest-name"]`, clears the error, and calls `action("/join", { shareCode })`.
  - `onJoinLobby` (`GameBoard.tsx:361`): `() => void action("/join", { shareCode })`.
- Neither path falls back to `game.shareCode`, and neither checks that `shareCode` is defined.
- Server contract:
  - `joinGameInputSchema` requires `shareCode: z.string().min(1).max(100)` (`schemas/game.ts:425`).
  - The service `joinGame` requires `game.shareCode === input.shareCode` (`services/games/index.ts:1454-1469`).
- Consequence: a join from a URL without `?share=` sends `shareCode: undefined` and fails schema validation (see 4.1).
- The creator is redirected by `GameCreateForm` to `/games/${id}` without a share query.

### 2.4 Award dialog lifecycle (`GameBoard.tsx:61-138`)
- State: `awardOpen` (`useState(false)`), `awardKeyRef`, `previousStatus`, `previousPlayerCount`.
- The main effect (`useEffect(..., [game])`, `:73-132`):
  - Shows toasts on new players, on a `cancelled` transition (solo vs. crew message), and on a `complete` transition.
  - Computes `isTerminal`, `hasLedger` (`stageLedger.length > 0`), `transitioned` (previous status non-null, different, terminal), and `reEntry` (previous status null and terminal).
  - If `(transitioned || reEntry) && hasLedger`, it reads `sessionStorage["award-dialog:dismissed:<game.id>"] === "1"` (read errors count as not dismissed).
  - If not dismissed and `awardKeyRef.current !== game.id`, it sets `awardKeyRef.current = game.id`, schedules `setTimeout(() => setAwardOpen(true), 350)`, updates `previousPlayerCount` and `previousStatus`, and **returns `() => clearTimeout(t)`** as the effect cleanup.
  - Otherwise it updates `previousPlayerCount` and `previousStatus` at the end of the effect.
- A second effect (`[game?.id]`, `:134-138`) calls `setAwardOpen(false)` (with an `eslint-disable react-hooks/set-state-in-effect` comment). It does not touch `awardKeyRef` or any timer.
- There is no unmount-only cleanup effect and no timeout ref.

### 2.5 Challenge stage list (`ChallengeGameBoard.tsx`)
- `const stages = buildChallengeBoardStages(game)` (`:41`).
- Render: when `stages.length === 0` it shows `<EmptyStageRow />`. Otherwise it renders `stages.reverse().map(...)` (`:90-91`), newest first. `reverse()` reverses the array in place.

### 2.6 Weather forecast in the create form
- `GameCreateForm.tsx` gets `weather: forecastWeather` from `useSpotWeather(...)` (`:396`).
- When `forecastWeather` exists, both the **challenge** payload (`:1031-1034`) and the **training** payload (`:1063-1066`) send `weatherForecastIcon: forecastWeather.icon`, `weatherForecastDescription: forecastWeather.description ?? forecastWeather.icon`, and `weatherForecastTemp: forecastWeather.current`. The temperature is sent without rounding or null handling.
- `forecastWeather` can be falsy. Creation is gated on it in places (`:561`, `:807`, `:1110`), and when absent the payloads omit these fields.
- Schemas and types:
  - Input (`schemas/game.ts:337`): `weatherForecastTemp: z.number().int().min(-100).max(100).optional()`. This is not nullable.
  - Output (`schemas/game.ts:255`): `z.number().int().nullable().optional()`.
  - Domain type (`definitions.ts:216`): `weatherForecastTemp?: number | null`.
  - Service input type (`services/games/index.ts:1238`): `weatherForecastTemp?: number`. Persisted as `?? null` (`:1349-1354`).
- `forecastWeather.current` may be a decimal or `null`. Both are rejected by the input schema (see 4.3).

---

## 3. Existing Tests (relevant)
- `src/components/games/GameCreateForm.test.tsx` covers the create-form flows: mode radios, trick settings, challenge setup steps, nearby-spot acceptance, guest name, mobile training dialog. It has **no** weather-temperature tests.
- `src/components/games/board/` contains `ChallengeGameBoard.test.tsx`, `ChallengeRiderTracksSheet.test.tsx`, `GameBoardActionStatusModal.test.tsx`, and `RiderActivityBoard.test.tsx`. There is **no** `GameBoard.test.tsx`.
- Quality gate commands: `pnpm typecheck`, `pnpm lint`, `pnpm test src/components/games`, `pnpm test src/lib/games src/lib/services/games`.

---

## 4. Known Edge-Case Behaviors (documented, not changed)

### 4.1 Join without `?share=`
Direct navigation to or reload of `/games/[id]` with no `share` query makes both join entry points send `{ shareCode: undefined }`. `joinGameInputSchema` rejects it with HTTP 400 and `details: { shareCode: ["Required"] }`. `game.shareCode` is already available in the loaded game state but is not used.

### 4.2 Award dialog timing
The 350ms timer's cleanup is tied to the `[game]` effect. If another `game` state arrives (realtime or polling) within 350ms of the terminal transition, React runs the cleanup and cancels the timer. On the re-run, `awardKeyRef.current === game.id` is already true, so the timer is not rescheduled. The dialog then does not open for that game until `game.id` changes (which does not reset `awardKeyRef`) or the component remounts.

### 4.3 Weather temperature on create
A `null` or non-integer `forecastWeather.current` produces a request that fails input validation, because the schema is not nullable and requires an integer. Output and domain types already allow `null`.

### 4.4 `params` not forwarded
`GameBoard` depends on `useParams()` for the game id. The server page awaits `searchParams` and the session but not `params`, and passes no `gameId`.

### 4.5 In-place `reverse()`
`stages.reverse()` mutates the array returned by `buildChallengeBoardStages` during render.

---

## 5. Constraints for Any Future Change
1. Keep the layering in section 1. Domain rules stay in the engine, writes stay in services.
2. Preserve current features, game rules, and UX/UI unless a change is explicitly requested.
3. Code must pass `pnpm typecheck` (strict, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`) and `pnpm lint`.
4. Any change to the items in section 4 should add the missing tests listed in section 3.
