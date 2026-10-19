# Challenge Game Flow: Current-State Specification

Describes the behavior of the challenge game flow (`GameCreateForm`, `GameBoard`, `ChallengeGameBoard`, game schemas) **as implemented in the current code**, after the flow-repair pass. Features, game rules, and UX/UI are unchanged by that pass. Section 4 records the edge cases that were repaired and the invariants that keep them fixed.

Line references drift. Re-verify before relying on them.

---

## 1. Scope & Layering

| Layer | Location | Role |
|---|---|---|
| Domain engine (pure) | `src/lib/games/*` | State machines, scoring, capabilities, board model. No DB/IO. |
| Service orchestration | `src/lib/services/games/index.ts` | Only writer. Authorizes access, validates share codes, persists. |
| Input/output schemas | `src/lib/schemas/game.ts` | Zod request/response contracts. |
| API routes | `src/app/api/games/**` | Route handlers (`[id]/join`, `start`, `cancel`, `leave`, `train-alone`, `rounds/[roundId]/*`, ...). |
| Pages | `src/app/games/**` | `[id]/page.tsx`, `join/[shareCode]/page.tsx`. |
| UI | `src/components/games/**` | `board/GameBoard.tsx`, `board/ChallengeGameBoard.tsx`, `create/GameCreateForm.tsx`, hooks. |

---

## 2. Current Behavior by Area

### 2.1 Route page (`src/app/games/[id]/page.tsx`)
- `GamePage` is an async server component with `params: Promise<{ id: string }>` and `searchParams: Promise<{ share?: string }>`.
- It awaits `params`, `searchParams`, and `getSessionUser()` together via `Promise.all`.
- It renders `<GameBoard gameId={id} userId={user?.id ?? null} shareCode={share} />`.
- `generateMetadata` in the same file also awaits `params`.

### 2.2 `GameBoard` props and game id
- Props: `{ gameId?: string; userId: string | null; shareCode?: string }`.
- Effective game id: `gameId = propGameId ?? routeParams?.id ?? ""`, where `routeParams` comes from client-side `useParams<{ id: string }>()`. This effective id is passed to `useGameRealtime(gameId, shareCode, { authenticated })` and `useGameAction({ gameId, ... })`.

### 2.3 Lobby join
- Both entry points (`submitGuestJoin` and `onJoinLobby`) call one helper, `joinLobby()`:
  - `effectiveShareCode = shareCode || game?.shareCode`.
  - If neither exists, it returns without a request.
  - Otherwise it calls `action("/join", { shareCode: effectiveShareCode })`.
  - The URL `?share=` value takes precedence over `game.shareCode`.
- `submitGuestJoin` still validates the name first through `normalizeGuestName`. An empty name shows "Pick a Name — 1 to 30 Characters." and returns. Otherwise it saves the name in `sessionStorage["openspot-guest-name"]`, clears the error, then calls `joinLobby()`.
- Server contract is unchanged:
  - `joinGameInputSchema` requires `shareCode: z.string().min(1).max(100)`.
  - The service `joinGame` requires `game.shareCode === input.shareCode`.
- The creator is redirected by `GameCreateForm` to `/games/${id}` without a share query. Joining from such a URL works through the `game.shareCode` fallback.

### 2.4 Award dialog lifecycle (`GameBoard.tsx`)
- State: `awardOpen` (`useState(false)`), `awardKeyRef`, `awardTimeoutRef`, `previousStatus`, `previousPlayerCount`.
- Effects, **in declaration order** (the order is load-bearing):
  1. `[game?.id]` reset: `setAwardOpen(false)`, `awardKeyRef.current = null`, clears and nulls any pending `awardTimeoutRef`.
  2. `[]` unmount cleanup: resets `awardKeyRef` and clears any pending timeout.
  3. `[game]` main effect: toasts, terminal-transition detection, award scheduling.
- Main effect:
  - Toasts on new players, on a `cancelled` transition (solo vs. crew message), and on a `complete` transition.
  - `transitioned` is previous status non-null, different, and terminal. `reEntry` is previous status null and terminal.
  - If `(transitioned || reEntry)` and the ledger is non-empty, it reads `sessionStorage["award-dialog:dismissed:<game.id>"] === "1"`. Read errors count as not dismissed.
  - If not dismissed and `awardKeyRef.current !== game.id`, it sets `awardKeyRef.current = game.id`, clears any existing timeout, and stores `setTimeout(() => { setAwardOpen(true); awardTimeoutRef.current = null }, 350)` in `awardTimeoutRef`.
  - The effect does **not** return a cleanup for the timer, so later game updates do not cancel it.
  - It always updates `previousPlayerCount` and `previousStatus` at the end.
- Why the reset effect is declared first: on mount, effects run in declaration order, so the reset runs before the main effect and never cancels a freshly scheduled timer (the reload-on-finished-game case).

### 2.5 Challenge stage list (`ChallengeGameBoard.tsx`)
- `const stages = buildChallengeBoardStages(game)`.
- When `stages.length === 0` it shows `<EmptyStageRow />`. Otherwise it renders `[...stages].reverse().map(...)`, newest first. The copy leaves the original array untouched.

### 2.6 Weather forecast in the create form
- `GameCreateForm.tsx` gets `weather: forecastWeather` from `useSpotWeather(...)`.
- When `forecastWeather` exists, both the **challenge** and **training** payloads send `weatherForecastIcon`, `weatherForecastDescription` (`description ?? icon`), and `weatherForecastTemp`.
- `weatherForecastTemp` is `Math.round(forecastWeather.current)` when `current` is a number, and `null` otherwise.
- When `forecastWeather` is falsy, the payloads omit these fields (unchanged).
- Schemas and types:
  - Input (`schemas/game.ts`): `weatherForecastTemp: z.number().int().min(-100).max(100).nullable().optional()`.
  - Output: `z.number().int().nullable().optional()`.
  - Domain type: `weatherForecastTemp?: number | null`.
  - The service reads the field through a cast and persists `?? null`.
  - `SpotWeather.current` is `number | null` (`lib/weather/weather-cached.ts`).

---

## 3. Tests
- `src/components/games/board/GameBoard.test.tsx` (6 tests): share-code fallback for a signed-in joiner, prop precedence over `game.shareCode`, guest join with fallback, award dialog after 350ms despite rapid re-renders, award dialog on mount for an already-finished game, and no reopen when dismissed in `sessionStorage`.
- `src/components/games/GameCreateForm.test.tsx`: existing create-form coverage, plus two weather tests. A decimal temperature is rounded to an integer, and `null` is sent when there is no temperature. Both assert the body passes `createGameInputSchema`. The weather mock is controlled by `spotWeatherState.current`.
- Quality gate: `tsc --noEmit` (`pnpm typecheck`), `eslint` (`pnpm lint`), `vitest run src/components/games src/lib/games src/lib/services/games`.

---

## 4. Repaired Edge Cases & Invariants

1. **Join without `?share=`**: handled by the `joinLobby()` fallback (2.3). Keep the `shareCode || game?.shareCode` guard so the join request never carries `undefined`.
2. **Award dialog race**: the timer lives in `awardTimeoutRef`, not in effect cleanup (2.4). Keep the reset effect declared before the main effect.
3. **Weather temperature**: the payload is rounded and null-safe, and the input schema is nullable (2.6). Keep the form and schema in sync.
4. **`params` forwarding**: the server page passes `gameId` (2.1). `GameBoard` keeps the `useParams` fallback for renders without the prop.
5. **Stage list**: render without mutating (2.5).

---

## 5. Constraints for Any Future Change
1. Keep the layering in section 1. Domain rules stay in the engine, writes stay in services.
2. Preserve current features, game rules, and UX/UI unless a change is explicitly requested.
3. Code must pass `pnpm typecheck` (strict, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`) and `pnpm lint`.
