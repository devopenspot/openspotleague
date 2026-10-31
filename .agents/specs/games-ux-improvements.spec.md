# Spec: /games UX, UI & Color Improvements

- **Scope:** `/games` setup page, game lobby and invite drawer, live training session (`/games/:id`)
- **Source:** Manual audit as a signed-out guest at desktop (800px) and mobile (375px), 2026-10-29. Reviewed against the code the same day.
- **Test flow audited:** Preferences dialog → Sport: Skateboard → Training → Rider name → Start → Lobby → Ride solo → Landed / Failed
- **Priority:** P0 = blocks users · P1 = major friction · P2 = polish
- **Read first:** [Regression guardrails](#regression-guardrails). The audit only covered guest + solo, but every component below is also used by signed-in Challenge, 2-rider training, join-by-code and scheduled challenges.

## Root cause of the main blocker

`/games` opens the shared preferences dialog in **edit** mode for first-time visitors (`GameLanding.tsx:105-115`), so it can be dismissed with X, backdrop or Esc. Two things then go wrong:

- If it is dismissed, `preferredSport` stays `null`. The form only renders sport chips when `preferredSport === "all"` (`GameCreateForm.tsx:1176`), so **no sport picker is shown at all**.
- If it is left on "All disciplines", the chips render but nothing is selected.

In both cases the discipline is `null`:

- `/api/games/options` is never fetched.
- Spot types show "No compatible spot types are available for this game".
- Levels and mode chips are disabled.
- Desktop Start is disabled (`createDisabled`) with no reason shown.
- On mobile, Start opens the wizard, which only fails later with "Choose a compatible spot type".

---

## Setup page (`/games`)

Files: `src/components/games/create/GameCreateForm.tsx`, `form-parts.tsx`, `trick-catalog-filters.ts`, `src/components/games/layout/GameLanding.tsx`.

- [x] **1. [P0] Always offer a sport picker when no sport is resolved**
  - Render the sport chips whenever `resolveGameDiscipline(...)` is `null`, which covers both `null` and `"all"`, not only `"all"`.
  - When no sport is selected:
    - Replace the empty spot-type message with "Pick a sport above to load spots and levels."
    - Highlight the Sport card with the selected-state border (monochrome, see item 17).
  - Desktop: show the reason next to the disabled Start, or keep Start enabled and, on click, scroll to and focus the Sport card with an inline error. Pick one pattern and use it everywhere.
  - Mobile wizard: add "sport selected" to `validateSetupStep` for the first step.
  - **Sport choice is local form state** (`selectedDiscipline`). It must not write `preferredSport`, because that store also filters the map (`MapTab.tsx`) and TV (`use-tv-discipline-state.ts`) and is synced to `/api/preferences`. A "Save as my default" control is optional and separate.
  - **Acceptance:** A guest who dismissed the dialog, or chose "All disciplines", sees a sport picker and knows what to do next. Map and TV filters are unchanged afterwards.

- [ ] **2. [P2] Number the setup steps (desktop)**
  - Number the desktop sections: 1 Sport → 2 Mode → 3 Rider name → 4 Trick settings. The mobile wizard already has steps.
  - Pre-selecting the sport needs no work: the preference is a single value and is already pre-selected through `resolveGameDiscipline`.

- [ ] **3. [Rejected] ~~Make the onboarding dialog require a sport~~**
  - `OnboardingDialog` is shared app-wide (`AppShell.tsx`). In onboarding mode it already requires a choice. "All disciplines" is valid for map and TV. Do not make the global dialog stricter.
  - Item 1 handles the `/games` case inside the form. The dialog can stay dismissible on `/games`.

- [x] **4. [P0] Fix the rider name display/submit mismatch**
  - **Cause:** `useState(getStoredGuestName)` reads `sessionStorage` in the initializer. The server renders `""` while the client state holds the stored name ("TestRider"). The input shows empty but the game starts with the stored name. This is a hydration mismatch, not two sources of state.
  - **Fix:** initialize to `""` and load the stored name after mount (an effect or `useSyncExternalStore`).
  - Validation already exists on click (`getSettingsErrors`: "Enter a rider name between 1 and 30 characters."). Show that message inline under the field, both desktop `guest-nickname-desktop` and mobile `guest-nickname-setup`, not just the generic "Review the highlighted fields".
  - **Acceptance:** The displayed value always equals the submitted value. An empty name blocks Start, with the reason shown next to the field. Guest name storage stays `sessionStorage` only.

- [ ] **5. [P1] Loading state after choosing a sport**
  - Today the loader is an empty grey div, duplicated in three places (`form-parts.tsx:211`, `GameCreateForm.tsx:1696`, `GameCreateForm.tsx:2042`).
  - Extract one `SpotTypeChipsSkeleton.tsx`. A `*Skeleton.tsx` file is the only place `animate-pulse` is allowed.
  - Keep the selected sport chip in its active style while loading.
  - Optional: drop `cache: "no-store"` on the `/api/games/options` fetch. The route already sends `s-maxage=300, stale-while-revalidate=600`.

- [ ] **6. [P1] Training / Challenge toggle styling**
  - Both chips show at `opacity-40` only because `!discipline` disables them. Item 1 removes that cause.
  - Rule: a **selected** chip is never rendered in the disabled style.
  - Challenge for guests: add a lock icon. The "Sign in to unlock Challenge" helper copy already exists.

- [ ] **7. [P2, separate preferences item] Preferences dialog: close button and unit defaults**
  - In edit mode the X already calls `closeOnboarding()`, and the backdrop already closes (`closeOnBackdrop={!isOnboarding}`). Reproduce the "X doesn't close" bug before changing anything; check click handling in `Overlay.tsx`.
  - Unit defaults (`mi` + `C`, `preferences-store.ts`) are app-wide. Infer them from the locale **only** when nothing is stored, locally or on the account, so they never override synced preferences. This is not `/games` scope.

## Lobby & invite drawer

Files: `src/components/games/board/GameBoardControls.tsx` (live, rendered) and `src/components/games/layout/header-parts.tsx` (`GameShareDrawer`, `CancelSessionDialog`). `Header.tsx` is deprecated; do not edit it for these items.

- [x] **8. [P1] Shorten the solo start path**
  - Current path: Start Training → drawer auto-opens → "Continue to session" (only closes the drawer) → Ride solo.
  - Shipped differently: **Ride Solo** on `/games` creates the lobby and calls `/train-alone` in one tap, and the game-sheet offers it in the lobby. The share drawer no longer opens by itself.
  - Keep creating the game in the lobby. `createGame` defaults to `multiplayer`, and `startSoloTraining` requires lobby, creator and exactly one active rider.
  - **Acceptance:** A solo session starts with one click after Start Training. 2-rider training and scheduled challenges, where the drawer does not auto-open, are unchanged.

- [x] **9. [P1] Invite drawer action hierarchy and sharing**
  - Hierarchy:
    - Primary (black): **Ride solo now**.
    - Secondary: **Copy invite link / QR**.
    - Tertiary: **Close**.
  - "Continue to session" only closes the drawer, so it is not the primary action.
  - Make the existing QR (`ShareActions.tsx`, `QRCodeSVG`) visible by default instead of behind a toggle. Show the `/s/<7-char>` short link when it is available.
  - **Do not change the `share_code` format.** It is a 144-bit bearer token that grants read access to the game (`assertAuthorizedGameAccess`, `services/games/index.ts`). A code like `SKT-4821` would make active lobbies guessable. A human-typed join code would need its own column, real entropy and a rate-limited join page. That is a separate spec.
  - Copy: training allows at most 2 riders (`PLAYER_LIMITS`), so say "Invite a rider", not "Invite crew".

- [ ] **10. [P2] Fill the empty lobby state**
  - The letter slots already render in the lobby (`ChallengeRiderTracks`). Replace the blank trick area under "Setting up your line" with:
    - A rules summary.
    - "Waiting for a rider / Ride solo" actions.
  - Say clearly that **solo is free ride: no letters, no elimination** (see item 11).

## Live session (`/games/:id`)

Files: `src/components/games/board/ChallengeGameBoard.tsx`, `ChallengeRiderTracks.tsx`, `GameBoard.tsx`, `src/components/games/layout/TrickActionDrawer.tsx`, `src/components/games/hooks/useGameAction.ts`.

- [ ] **11. [P1] Show solo progress instead of the letter board**
  - **This is intended behaviour, not a bug.**
    - Solo training gives no letters: Landed and Failed both resolve the round and draw the next trick (`engine.ts`, solo branch of challenger result).
    - The rider board is hidden on purpose when `trainingVariant === "solo"`.
    - It is visible in the lobby only because the variant is still `multiplayer` until Ride solo.
  - Do not show S-K-A-T-E slots in solo; that would misrepresent the rules.
  - Add a **solo tally** instead (landed / attempted / current streak). Compute it server-side in the projection, because client history is capped by `DEFAULT_GAME_HISTORY_LIMIT`.
  - Multiplayer training and Challenge keep the letter board unchanged. Letters still go only to responders who fail.

- [ ] **12. [P1] Instant feedback on Landed / Failed**
  - **Cause of "Finding…":** one shared `busy` flag (`useGameAction.ts`) drives the Next button label (`TrickActionDrawer.tsx`). Every action shows "Finding…" for the whole POST + refresh GET, including a possible stale-version retry.
  - **P1:** Track which action is pending (`landed` / `failed` / `next`) and label only that control. Add a **one-shot** success/failure transition. No looping animation, because pulse animations are banned.
  - **P2 follow-up:** Return the next round in the mutation response so the follow-up GET can be skipped. It must preserve idempotent replay (the stored response for a replayed key), OCC `expectedVersion`, and the 304 version pre-check on GET.
  - Client-side "prefetch next trick" is **not feasible**. The catalog is server-only and the used-trick history is capped.

- [ ] **13. [P1] Validate trick difficulty per level**
  - "Fakie Boneless 180" and "Fakie Body Varial" are `"level": 1` in `src/data/tricks/skateboard.json`.
  - Audit level 1 (and adjacent levels) in all four catalogs: skateboard, bmx, scooter, roller.
  - Add a Vitest test asserting a minimum pool for every `spotType × level`. Then demoting tricks can't empty a level and silently trigger the fallback in `computeLevelsForSpotAndCategories`.
  - Reseed with `pnpm db:seed-tricks:<discipline>`, which uses replace semantics. Live games keep their stored `trickSourceId`.

- [ ] **14. [P2] Rewrite trick descriptions**
  - Short, step-style copy in `src/data/tricks/*.json`.
  - Video/GIF needs a new catalog field plus a migration. Track it as a separate item.

- [x] **15. [P2] Remove duplicate trick controls**
  - Landed / Failed / Next appeared in both `TrickActionDrawer` and the current round row in `ChallengeGameBoard`.
  - Target: the game-sheet on mobile (`DESIGN.md`, `components.overlays.game-sheet`), the inline row on desktop. The inline row must then also hold the trick details and Next.
  - `TrickActionDrawer` is removed. Nothing auto-opens during play on any viewport.

- [x] **16. [P2] Clarify session labels**
  - "Your turn — open panel" → "Open trick".
  - "Next · 3" swaps the trick, at most 3 per round, flexible rules only → "Skip trick (3 left)".
  - "Switch it up" opens line settings (spot type, level, categories) → "Change line".
  - "Finish run" **already** asks for confirmation (`CancelSessionDialog`); no change needed.
  - Finish sets the status to `cancelled`, not `complete`. Do not change that here; it affects results, awards and history.

## Visual design & color (global)

Constraint: `DESIGN.md` is the source of truth. A change that conflicts with it needs a `DESIGN.md` update first.

- [ ] **17. [P1, narrowed] Visual language consistency**
  - **Rejected:** a brand-red accent for primary buttons and selected states. `DESIGN.md` makes primary CTAs and selected states black (`--color-primary`). It reserves the orange→red gradient for the Home hero and the **Games landing**, so the setup gradient is allowed.
  - **Keep:** fix the white band at the bottom of the desktop gradient. Keep panels on the gradient monochrome.

- [ ] **18. [P1, narrowed] Contrast and type scale (WCAG AA)**
  - Labels at 10–12px uppercase are the `DESIGN.md` convention. Don't change them app-wide here.
  - Fix the real failures on `/games`:
    - White 12px helper text on the gradient.
    - "Game rules" / "Rider policy" white-on-10%-white.
    - 40%-opacity chips.
    - Grey-on-grey states.
  - Use sentence case for helper text. Text contrast must be at least 4.5:1.

- [x] **19. [P2] Tap targets and component consistency**
  - `OptionChip` and the level buttons need a hit area of at least 44px (padding or a pseudo-element; the visual size can stay). Make the checkbox label clickable.
  - Use the button and chip tokens already defined in `DESIGN.md` (primary / secondary / accent) and one selected-state style. Do not invent new tokens.
  - While touching these files, replace `rounded-[16px]` / `rounded-[8px]` literals with the `DESIGN.md` radius classes.

- [x] **20. [P1] Mobile layout**
  - Bug: the sticky Start bar is `bottom-18` (72px) but the mobile nav is 77px. `--mobile-nav-h` said 64px, and is now corrected.
  - Bug: between 768 and 1023px the nav is hidden (`md:hidden`) but the bar still shows (`lg:hidden`), so it floats above an empty gap.
  - Anchor the bar to `--mobile-nav-h` below `md` and to `bottom-0` from `md` to `lg`.
  - Merge the summary and Start into one sticky bar ("Skateboard · Plaza · L1 — Start").
  - Reproduce "page opens partway down at the summary" before changing scroll behaviour.

## Additional copy & structure notes

- Show visually hidden section labels ("Spot type", "Level", "Rule mode", "Record at registered spot").
- Add a page H1 and a one-line explanation of Training vs Challenge.
- Make the "Your setup" summary rows (`ConfigurationSummary`) clickable so each jumps to its field, and highlight missing values.
- Collapse the Categories card when none are configured. Remove the non-link "Continue." text in `CategoriesField` (`form-parts.tsx`).
- Explain "Your elimination word appears here", and hide it in solo.

---

## Regression guardrails

Every item above must preserve these behaviours. Verify them manually before merging.

- **Prefill flows:**
  - Challenge prefill from a spot page; guests are still blocked from Challenge.
  - A prefill spot still auto-enables "Record at registered spot", with location and weather confirmation.
- **Challenge mode:**
  - Location verification, the 15-minute start window and strict rules.
  - Scheduled challenges, where the share drawer does not auto-open.
- **2-rider training:**
  - `/games/join/{code}`, `JoinWithCode`, `/s/*` short links, and the OG preview for crawlers.
  - The join limit of 2 players.
- **Server contract:**
  - `expectedVersion` OCC and idempotency keys on every action.
  - The 304 version pre-check.
  - 2s polling stays under the `games` 60/min rate-limit tier.
  - Guests stay on polling only, with no realtime channel.
- **Shared preferences:** `preferredSport` and units still drive map, TV, weather and spot details. Signed-in sync through `/api/preferences` is unchanged.
- **Guest limits:** at most 3 training games per IP. The guest name stays in `sessionStorage` only.
- **Terminal states:** `TerminalResultBar`, "Run it again", and the terminal caching headers.
- **Matrix:** test each change as guest and signed-in, at desktop, 768–1023px and 375px.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Existing tests to keep green and extend: `header-state` and `trick-catalog-filters`. Add the trick pool test from item 13.
- Manual pass of the guardrail flows above.

## Revised priorities

- **P0:** 1, 4
- **P1:** 5, 6, 8, 9, 11, 12 (pending state), 13, 17 (gradient band only), 18 (narrowed), 20
- **P2:** 2, 7, 10, 12 (server response), 14, 15, 16, 19
- **Rejected / needs `DESIGN.md` or a separate spec first:** 3; the short crew code in 9; the red accent in 17
