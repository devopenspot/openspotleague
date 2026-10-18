# League verification spec

Quality gates and test matrix for the league/events redesign rollout. Local checks are the repo's gate (no CI).

## Phase gates

1. **Schema + migration** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (build stays DB-free via `withSafeDefault`); DB verification on a scratch database only: `pnpm db:fresh:seed`, updated `pnpm db:verify-phase7`, new `pnpm db:verify-league` (`scripts/verify-league-redesign.ts` smoke: create event → member → invite → run → score → results publish through services; asserts constraints and ledger/stats side effects).
2. **Engine + services + API** — engine unit tests green; route contract tests green; manual smoke of create → join → schedule → score → publish on scratch DB.
3. **UI** — component tests (judge view, invites QR, schedule editor, role-aware detail); a11y spot checks (keyboard-only judging, focus management); `pnpm build`.
4. **Admin + payments** — admin route tests with `league.manage` gating; manual flow: request upgrade → mark paid → capacity unlocked → account plan raised.
5. **Cleanup** — deprecated shims deleted (`src/lib/repositories/event-repository.ts`, `event-pagination.ts`, `drizzle-event-repository.ts`, `src/lib/services/events.ts`), dead code removed, `AGENTS.md`/docs cache notes updated; full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Test matrix

- **Pure engine** (vitest, no DB): lifecycle transitions + guards; capability matrix (organizer-judges-implicitly, main-organizer-only removal); capacity math per plan; monthly quota (UTC month boundaries, seed exclusion); **payment gate** (pending → locked at 3d → disabled at 6d; settled via any registered payment; payment window open/closed); **scheduling advance window** (2-month cap); schedule generation (ordering, slot math, timezone); scoring math (weights, mean, rounding); ranking + tie-breaks (total → best judge total → sequence); points computation; invite validity (expiry/max-uses/revoked).
- **Contract**: zod schemas (`schemas/league.ts`, updated `schemas/event.ts`); ETag/`?version=` 304 behavior; idempotent replay + fingerprint mismatch; error→status map.
- **Integration** (scratch DB scripts/services): join under capacity boundary; window enforcement (submit before/after expiry, extend-then-submit); publish-results transaction atomicity (results + ledger + rider_stats together or nothing); unique-constraint violations surface as typed 409s.
- **DB/constraints**: one active membership per user/event; one active main organizer; unique invite code; unique `(event_id, rank)`; realtime publication membership + signal RLS policy; `user_notifications` RLS (owner-only) + publication entry.
- **Notifications**: copy renderer (pure) covers every type with payload-derived text; fan-out unit tests resolve recipients per trigger (members/organizers/`league.manage` holders) and dedupe; route tests for list pagination + unreadCount + mark-read (ids/all) with 401/429 paths.
- **Components**: organizer console renders runs/scores; judge sliders + countdown; invite QR encodes the invite URL; role-aware detail switches correctly per viewer role.

## Migration safety

- Never run `db:reset` / `db:fresh` against production; scratch/staging DB only.
- Applied migration files immutable — semantic fixes ship as new files; drift hashes normalize formatting only.
- Rollback story: destructive drop-and-recreate; roll forward only. Backup/snapshot the target DB before applying 0026 outside local dev.

## Manual QA checklist (per release)

- Two-browser realtime: organizer console ↔ judge submit ↔ rider results within one window.
- Notifications: bell badge updates on invite/schedule/results events in a second browser; `/notifications` list marks read and deep-links correctly.
- Invite QR on a real phone (scan → sign-in → join), expired + revoked invite paths, capacity/quota rejection copy.
- Free-tier constraints: no judge/organizer invites, 3-rider cap, organizer judges implicitly.
- Paid flow: pending payment visible to organizer, admin marks paid, caps unlock, account plan 21/month verified.
- iOS Safari: no zoom-on-focus on any league form.
