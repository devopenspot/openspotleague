# League: run a contest end to end (organizer, judge, rider)

Status: planned, not started. Written 2026-11-10.

This is the working plan for the next League iteration. It covers the views, components, data model and security needed for an organizer, a judge and a rider to run a contest from creation to published results, and it pays down the technical debt found on the way.

## Before you start

- **Prerequisite:** the notifications module is deployed ([`docs/notifications-deploy.md`](../notifications-deploy.md)) and merged to `main`.
- **Branching:** one branch and one pull request per phase, each from an up-to-date `main`.
- **Migrations:** hand-written, one concern per file, numbered from the next free number (`0011` if nothing else has landed). Applied migrations are never edited.
- **Database for tests:** the develop Supabase instance (the one `.env.local` points at). Never production.
- **Rules:** everything in [`AGENTS.md`](../../AGENTS.md) applies. The ones that matter most here: page/route → service → repository; League writes go through the League service with a version check, an idempotency fingerprint and a realtime signal; notifications only through `createNotifications(tx, …)`; contest URLs only from `src/lib/league/urls.ts`; UI from `src/components/ui/recipes.ts`; the build stays database-free.
- **Gate for every phase:** `pnpm lint && pnpm typecheck && pnpm test`, the League chain test on develop, and a browser check at phone width. `src/components/tv/grid/TvGrid.test.tsx` already fails on `main` and is unrelated.

## Decisions already made

| Topic | Decision |
| --- | --- |
| Judge video | YouTube and Vimeo play inside the scoring card. Instagram and Drive stay as links. |
| Contest-day mistakes | The organizer can reopen a run, mark a rider as no-show or disqualified, and reopen judging before results are published. |
| Organizer rides | An organizer may also ride. Nobody scores their own run. |
| Free plan | Gets 1 judge seat (was 0), so someone else can score a riding organizer. |
| Corrections | Results can be corrected and republished within a limited window. League points are recalculated. |
| Old format | Contests with `open` divisions (4 criteria) are frozen: results still display, scoring is no longer possible, the old form is deleted. |
| Payments | A payment module is in scope. The provider is chosen just before phase 6 (see [Payments](#payments-research)). |

## Findings

### Blockers: the flow cannot finish today

| # | Problem | Where |
| --- | --- | --- |
| B1 | There is no "Publish results" button. The next-step card tells the organizer to publish, but no component calls `results/publish`. | `src/components/league/manage/ManageConsole.tsx` (lifecycle buttons, about lines 452–513) |
| B2 | `listEventMembers` calls `lockEvent` (`SELECT … FOR UPDATE`) inside a read-only transaction. Postgres rejects that, and the console ignores the failure, so the member list stays empty. | `src/lib/services/league/index.ts` (`listEventMembers`, `READ_TX_OPTIONS`) |
| B3 | `inviteCodeFromBytes` indexes a 62-character alphabet with a 6-bit mask. Indexes 62 and 63 append the text "undefined", so about 12% of codes contain part of it. | `src/lib/league/engine.ts` |
| B4 | Scores, videos and entries are checked against the whole contest's version. Two people acting at once get "The event changed since you loaded it". Worst at the video deadline. | `submitRunScore`, `submitRunVideo`, `updateMyEntry` |
| B5 | A live run closed by mistake cannot be reopened. A run closed with no scores becomes `skipped` for good. | `setRunWindow` |
| B6 | After a failed join the button disappears. An existing member gets an error instead of the contest. Payment request errors are discarded (`onError={() => undefined}`). | `JoinWithInvite.tsx`, `ManageConsole.tsx` (`PlanPaymentActions`) |

### Security

| # | Problem | Fix |
| --- | --- | --- |
| S1 | Only `sport_events`, `user_notifications` and `user_email_preferences` have row-level security. The League child tables and `event_realtime_signals` have none. Any signed-in client can subscribe to every contest's signals, and tables holding invite codes, video links and scores may be readable through the Supabase API, depending on grants. | Enable RLS on every League child table (the server connects as the table owner, so Drizzle is unaffected). Add a member-only read policy on `event_realtime_signals` with the existing, unused `is_event_participant()`. Run the Supabase security advisors on develop before and after. |
| S2 | `GET /api/league/invites/[code]` needs no sign-in, has no route limit, and returns the contest name, city, slug and start time even for revoked or expired codes. | Return details only when the invite is usable. Apply the join rate limit. Stop echoing the code in error messages. |
| S3 | `POST /api/league/events/[id]/members` lets an organizer add any user id to a contest, at any status, without that person's consent. No UI uses it. | Remove the route and `addEventMember`. Joining is by invite only. |
| S4 | `leaveEvent` checks no status and no role. Removed and withdrawn riders keep their runs and can still be ranked. `updateMyEntry` skips the payment gate. `publishEventResults` accepts a `live` contest and silently drops unfinished runs. | Put the status rules in the engine. Publishing requires `completed`. A rider leaving after runs exist marks those runs withdrawn. |
| S5 | A judge sees every run's running panel score before submitting their own. | Hide `panelScore` and `judgedCount` from a judge until their own score for that run exists (`src/lib/league/visibility.ts`). |
| S6 | `video-links.ts` accepts any subdomain and any path of the allowed hosts, including redirect paths. | Exact host list and known watch-URL shapes only. |
| S7 | Route ids are not validated, so a malformed id returns 500. The idempotent replay is looked up after the version check, so an honest retry returns "stale" instead of the stored result. The replay lookup key differs from the table's unique constraint. | Validate ids in one route helper. Look up the replay first, keyed like the constraint. |

### Architecture and technical debt

- `src/lib/services/league/index.ts` is 5,494 lines. The same write sequence (lock, version, capability, gate, fingerprint, bump, record, signal, tags) is copied about 19 times. Five mutations bump the version inline, twelve use `bumpEventVersion`.
- The only database test of the service (`league-chain.smoke.test.ts`) is skipped unless `RUN_DB_SMOKE=1`. Route tests mock the service.
- 26 route files under `src/app/api/league/**` are near-identical envelopes.
- Reads (`getLeagueEventState`, `getInvitePreview`, `listEventMembers`) run inside a transaction of about nine queries, against the project rule that reads are not wrapped in transactions.
- The hub refetches the whole state on every signal for every member. `useLeagueRealtime` never passes the current version, and the `304` version pre-check is never used.
- `useContestState.load()` swallows errors, so the polling fallback never starts. The `connection` value is never shown.
- No API error code is handled in the UI. One global `busy` flag disables every button.
- `ManageConsole` (949 lines), `MyRunsPanel` (423), `JudgingPanel` (282), `ContestHub` (201), `StandingsBoard`, `useContestState` and `realtime.ts` have no tests.
- Duplicates: the "is this division rated" check (three places), Junior/Senior labels (three), role labels (two, next to `roleLabel`), `CATEGORY_OPTIONS` (two), the hub tab type (`HubTab` and `ContestHubTab`).
- The settings form sends `shortName`, `description`, `timezone`, `city` and `venue` but has no inputs for them, cannot edit divisions or mode, and never re-syncs with live updates.
- No confirm on remove member, revoke invite, remove cover or close window. "Save changes" does ask for one.
- Time zones: the video deadline is end of day in UTC, not in the contest's zone. Invite expiry and payment dates print in UTC.
- Hard-coded plan prices in `PlanPaymentActions`. Hard-coded `"/league"` in `MyRunsPanel` and `/league/join/…` in `join-input.ts`.
- `league_video_submitted` goes to judges only, so on a contest with no judges the organizer who scores is never told.
- Nothing prunes `event_action_requests` or `event_realtime_signals`.
- Stale leftovers: `src/db/reset.ts` (lists dropped tables, misses `event_divisions` and `event_division_entries`), the `db:health` realtime probe (games only), `docs/league.md` (still lists `league_email_log`), `docs/database.md` (says the deferred trigger is 0009; it is 0010), unused `pickOpenRun` and `isWindowActive`, the `history` route with no caller.

## Target experience

### Organizer

- **Create** (`/league/new`): at least one division is required. The video deadline is entered in the contest's time zone.
- **The next-step card does the action.** "Open registration", "Close registration", "Start contest", "Complete contest" and "Publish results" run from the card, with a confirm when the step cannot be undone. Today the card only switches tabs.
- **Run the contest** tab, in five sections:

| Section | Content |
| --- | --- |
| Setup | Every detail (name, short name, description, dates, time zone, city, venue, category, listing), format and divisions while the contest is in setup, cover, links. Plain Save, no confirm. The form re-syncs when another organizer saves. |
| People | Invites with QR, members with their role, remove and revoke behind a confirm, and the "I'm also riding" switch. |
| Runs | Start order with move up and down, slot and window length, open, extend and close, **reopen**, **no-show** and **disqualify**, and which judges have scored each run. |
| Results | Review per division with warnings (skipped runs, runs with fewer scores than the panel), **Publish**, and later **Correct results**. |
| Plan | Plan prices read from the API, payment state, errors shown. |

- A disabled button says why. Destructive confirms use a destructive style.

### Judge

- A judge or organizer invite works until the contest completes (today only while registration is open) and lands on the Judging tab.
- One run at a time, built for a phone: embedded player, criteria steppers, a submit bar that stays in view.
- Drafts are kept on the device per run, so a dropped connection loses nothing.
- Queue with progress ("3 of 12") and a division filter. After a submit the next run opens, a short confirmation shows, and focus moves to the new run's heading.
- A judge can never score their own run, and sees the panel score only after submitting.
- A connection badge shows connected or reconnecting.

### Rider

- **Join:** invite preview → sign in → pick divisions and category in the same screen → land on My runs. Errors keep the button. An existing member goes straight to the contest.
- **My runs:** the required-elements checklist, the video form with a link check and a preview player, the deadline in the contest's time zone with a countdown. In live contests: "You're up" and "3 riders before you".
- **Withdraw:** before runs exist the entry is removed. After that the runs are marked withdrawn. Not possible once the contest is completed.
- **Results:** rank, score, points, per-judge breakdown, share card, and a notice when results were corrected.
- Every member sees a banner when the contest is locked for payment.

## Architecture

### One write runner

New file `src/lib/services/league/mutation.ts`. Each mutation becomes a short handler.

```ts
interface EventMutation<TInput, TResult = void> {
  action: string                          // idempotency namespace
  scope: "contest" | "member"             // "contest" requires expectedVersion
  capability: EventCapability | null      // null: the handler checks (rider-only actions)
  gate: "writable" | "payment-window" | "none"
  curatorAllowed?: boolean
  handler(ctx: {
    tx: Tx; locked: LockedEventRow; role: EventRole | null
    userId: string; input: TInput; now: Date
  }): Promise<{ patch?: Partial<EventPatch>; signal: EventSignalType; result?: TResult }>
}
```

Order inside the runner: lock the contest row → look up the idempotent replay → version check (`scope: "contest"` only) → capability → payment gate → handler → bump version → record the action → record the signal → queue cache tags. Notifications stay inside the handler through `createNotifications(tx, …)`.

### Two concurrency scopes

| Scope | Actions | Version check |
| --- | --- | --- |
| `contest` | lifecycle, settings, cover, invites, remove member, schedule and reorder, run windows and outcomes, publish and corrections, payment | `expectedVersion` required |
| `member` | score, video, entry, join, leave | none; the row lock serializes them |

Both scopes still bump the contest version, so realtime keeps working.

### Service split

`index.ts` stays as the import path and only re-exports.

| File | Content |
| --- | --- |
| `mutation.ts` | The runner, `lockEvent`, fingerprints, action records, signals |
| `state.ts` | `getLeagueEventState`, `getLeagueEventVersion`, role projections |
| `create.ts`, `config.ts` | Create, settings, cover, divisions |
| `members.ts` | Invites, preview, join, leave, remove, riding switch |
| `lifecycle.ts` | Registration, schedule, reorder, start, complete, cancel, reopen judging |
| `runs.ts` | Windows, reopen, outcomes, scores, videos, entries |
| `results.ts` | Publish, corrections, the shared ranking computation |
| `payments.ts`, `plans.ts` | Payments, plans and account plans |
| `curation.ts`, `history.ts` | Curator reads, my contests, dashboard |

Move one mutation at a time, simplest first (`openEventRegistration`), with the chain test green after each move.

### Routes

Extend `src/app/api/league/helpers.ts` with one wrapper that does session, rate limit, UUID validation of path ids, schema parsing and error mapping. Each route file shrinks to the schema and the service call.

### Client

- `src/lib/league/api-client.ts`: one fetch helper with timeouts that returns `{ ok: true, data }` or `{ ok: false, code, message }`.
- `src/lib/league/error-copy.ts`: maps error codes to plain messages (tested). `STALE_VERSION` reads "Someone else just changed this contest. We've refreshed it; try again."
- `useContestState`:
  - pending state per action instead of one `busy` flag
  - on `STALE_VERSION`, reload automatically
  - pass the current version to realtime so old signals are ignored
  - use the `?version=` pre-check and coalesce bursts of signals into one refetch
  - let a failed load reach the realtime coordinator so polling starts
  - expose the connection state; the hub shows it
- Success feedback through the existing `useToast`.

### Reads

Drop the read transactions. The state carries the contest version; if a write lands during the read, the next signal triggers a refetch.

### Components

```
src/components/league/hub/
  ContestHub.tsx  NextStepCard.tsx  LifecycleStepper.tsx  ConnectionBadge.tsx
  organizer/  SetupPanel  PeoplePanel  RunsPanel  ResultsPanel  PlanPanel  MetricsPanel
  judge/      JudgingPanel  JudgeQueue  ScoringCard  RatedScoreForm  useScoreDraft
  rider/      MyRunsPanel  EntryForm  RunCard  VideoForm  WithdrawButton
  shared/     RunPlayer  ConfirmButton  labels.ts
```

- Each file stays under about 250 lines and is built from `src/components/ui/recipes.ts`.
- `EntryForm` is shared by the join screen and My runs. `RunPlayer` is shared by the rider preview and the judge card.
- `ConfirmButton` gains a destructive variant and unique ids.
- `hubTabsFor` takes `{ role, rides }`, so a riding organizer also gets My runs.
- Tabs get arrow-key navigation. Loading placeholders stay skeleton components.

### Retention

The existing 15-minute notification tick deletes `event_action_requests` older than 30 days and `event_realtime_signals` older than 7 days, in bounded batches.

## Data model

| Migration | Change |
| --- | --- |
| `0011_league_rls` | `ENABLE ROW LEVEL SECURITY` on `event_disciplines`, `event_divisions`, `event_division_entries`, `event_memberships`, `event_invites`, `event_scoring_criteria`, `event_runs`, `event_scores`, `event_results`, `event_points_ledger`, `event_payments`, `event_action_requests`, `event_realtime_signals`, `user_event_plans`, `rider_stats`, `event_plans`. One policy: members may `SELECT` their contests' rows in `event_realtime_signals` through `is_event_participant()` (check the argument order in `0000_baseline.sql`). |
| `0012_league_indexes_checks` | Indexes on `event_runs(user_id)`, `event_runs(membership_id)`, `event_scores(judge_user_id)`. Check `event_scores.best_trick_total >= 0`. Check that a removed or withdrawn membership has `removed_at`. |
| `0013_league_run_outcomes` | `event_runs.outcome` (`dns`, `dsq`, `withdrawn`, nullable), `outcome_reason`, `outcome_by`, `outcome_at`. |
| `0014_league_riding_organizer` | `event_memberships.rides boolean not null default false`, backfilled to true for riders, with a check that a judge never rides. Free plan `max_judges` 0 → 1 (also in `src/data/event_plans.json`). |
| `0015_league_result_revisions` | Table `event_result_revisions` (`event_id`, `revision`, `reason`, `published_by`, `published_at`, `previous jsonb`). `sport_events.results_revision int not null default 0` and `results_correction_opened_at`. |
| `0016_league_payment_provider` | `event_payments.checkout_url`, `expires_at`. Table `payment_webhook_events` (`provider`, `provider_event_id` unique, `received_at`) so each webhook is processed once. |

Rules that follow from the model:

- The rider cap counts memberships with `rides = true`.
- A contest cannot start while any run has nobody other than its rider able to score it.
- `open` stays in the format check for history. It is never created and never scored.
- Before 0011 ships, confirm on develop that the browser's realtime client sends the user's session. If it does not, signals stop and only the polling fallback remains.

## Phases

### Phase 0: blockers

Goal: a free contest runs from create to published results entirely in the UI.

- **B1.** Add "Publish results" (with a confirm) where the contest is `completed` and unpublished, and make the next-step card call it. `publishEventResults` requires `completed`.
- **B2.** `listEventMembers` reads the creator without a lock and without a transaction. The console shows a message when the list fails to load.
- **B3.** `inviteCodeFromBytes` uses rejection sampling (accept bytes below 248, index with `% 62`). The service supplies enough bytes. Test: 10,000 codes match `^[A-Za-z0-9]{12}$`. Existing codes keep working.
- **B6.** The join screen keeps its button after an error, sends an idempotency key, and redirects an existing member to the contest. `PlanPaymentActions` reports errors through the shared action error.
- Remove the sentence about adding members "via the API" from the close-registration confirm.
- Tests: component tests for the join screen and the publish action; an engine test for the code generator; a chain-test assertion for the member list.

### Phase 1: foundation

Goal: two judges score at the same moment with no error, and no League table is exposed.

- Extend the chain test (video contest, several divisions, two judges) and document how to run it on develop.
- Build the write runner and move every mutation onto it; split the service.
- Apply the two concurrency scopes (B4). The client stops sending `expectedVersion` for member actions.
- Route helper with id validation (S7).
- Client: `api-client.ts`, `error-copy.ts`, the `useContestState` changes, toasts, connection badge.
- Migrations `0011` and `0012`.
- Security: S1, S2, S3, S4, S5, S6.
- Retention in the tick.
- Leftovers: `reset.ts`, the health probe, the two docs, unused helpers, duplicate labels and types, hard-coded paths.

### Phase 2: rider

Goal: a rider goes from the QR code to a submitted video on a phone without leaving the hub.

- Join screen with `EntryForm`; land on `?tab=my-runs`.
- `RunPlayer` and the stricter `video-links.ts` (parse YouTube and Vimeo ids; pure and tested). Embeds use `youtube-nocookie.com` and `player.vimeo.com`, load only when the rider or judge presses play, and need `frame-src` for those two hosts in **both** `next.config.mjs` and `src/lib/security/headers.ts`.
- `VideoForm` with a link check and preview; deadline shown and stored in the contest's zone (a pure `endOfDayInZone` helper, tested).
- Live contests: "You're up" and the number of riders ahead (pure helper in `hub-state.ts`).
- Withdraw with migration `0013`.
- Payment-lock banner for every member; plan prices from the API.
- Notify organizers of a submitted video when the contest has no judges.

### Phase 3: judge

Goal: a judge scores a whole video queue on a phone, through connection drops.

- Judging tab rebuilt as `JudgeQueue` plus `ScoringCard` with `RunPlayer`.
- `useScoreDraft` (device storage, wrapped in try/catch, cleared after a successful submit).
- Engine rule and error code `SELF_SCORE` (403).
- Invites for judges and organizers stay usable until the contest completes (`joinableStatusesFor(role)` in the engine).
- **Old-format freeze.** Before shipping, count unfinished contests with `open` divisions on develop and on production (read-only); if any exist, a curator cancels or completes them first. Then:
  - creating a contest requires at least one rated division
  - `insertContestDivisions` no longer falls back to `open`
  - `submitRunScore` rejects `open` divisions
  - delete `RunScoreForm.tsx` and the legacy branch in `JudgingPanel`
  - keep the read path for published old results

### Phase 4: organizer

Goal: an organizer recovers from a wrong close and a no-show, then publishes.

- `NextStep.action` gains a mutation kind (`{ path, confirm }`) next to the tab kind.
- The five sections replace `ManageConsole`.
- Runs: reorder UI over the existing `reorderEventSchedule`, slot and window length, judge progress per run.
- New engine rules and service actions:
  - `reopenRun`: a `scored` or `skipped` live run goes back to `judging` with a new window
  - `setRunOutcome`: `dns` or `dsq` with a reason; the run becomes `skipped`; the rider is notified
  - reopen judging: `completed → live` while results are unpublished
  - reopen registration: `registration_closed → registration_open` while no runs exist
- Results review and publish.
- Riding organizer with migration `0014`: the switch in People, the entry through `EntryForm`, the cap, and the start check.
- Confirms on remove member, revoke invite, remove cover and close window.

### Phase 5: corrections after publishing

Goal: league points before and after a correction add up in the ranking.

- `openResultsCorrection(reason)`: main organizer only, within 7 days of publishing, at most 3 revisions. Standings show "Under review".
- While open, judges can update scores and the organizer can use the run actions from phase 4.
- `republishResults`:
  - computes ranks with the same function as the first publish (extracted into `results.ts`)
  - stores the previous results in `event_result_revisions`
  - replaces `event_results`
  - updates each ledger row by its `event_key` and adjusts `rider_stats` by the difference, in the same transaction
  - bumps `results_revision` and clears the correction flag
  - notifies only riders whose rank or points changed (new type `league_results_corrected`, digest urgency, results category, dedupe key per revision)
  - invalidates the ranking and profile caches through the existing helpers
- Test: after any number of corrections, the ledger total for the contest equals the points in its results.

### Phase 6: payments

Goal: a sandbox payment unlocks a contest with no admin action.

- `src/lib/payments/`: a provider interface with `createCheckout` and `verifyWebhook`, plus the existing manual flow as one provider.
- `POST /api/league/events/[id]/payment` creates the pending payment, then (after commit, never inside the transaction) asks the provider for a hosted checkout URL.
- `POST /api/webhooks/payments/[provider]` verifies the signature, records the event id in `payment_webhook_events`, and settles through the existing payment writer.
- The return page never settles anything; it shows the payment state and waits for the webhook.
- Card data never reaches the app.
- Provider secrets are declared in `cloudflare.config.ts` behind an opt-in flag, like the notification secrets.
- Refunds stay manual in admin for now.
- Tests with signed webhook fixtures, a replayed webhook and a wrong signature.

## Payments research

Checked on 2026-11-10. Confirm fees on each provider's own page before deciding.

| Option | Open to a Colombia-based seller | Currency | Cost on a $5 / $21 plan | Notes |
| --- | --- | --- | --- | --- |
| Stripe | No. The official country list has only Brazil and Mexico in Latin America. | n/a | n/a | Would need a foreign company. |
| Wompi (Bancolombia) | Yes | COP only | About 2.65% + COP 700 + IVA (bank and press pages; Wompi's price page could not be read) | Cards, PSE, Nequi. Hosted checkout, SHA-256 signed events, sandbox. Plan prices would need a COP value. |
| Merchant of record: Polar, Lemon Squeezy, Paddle | Yes. Colombia is on Polar's and Lemon Squeezy's payout lists. | USD, worldwide | 5% + $0.50, plus 1.5% for non-US cards: about $0.83 / $1.87 | They handle foreign sales tax. Paddle pays out only above $100 and asks for custom pricing under $10. |
| PayPal | Yes | USD | Roughly 4–5.5% plus a 3.5–4.5% conversion spread (third-party figures, not confirmed) | No setup, highest cost. |
| Mercado Pago | Likely | COP | Not confirmed (fee page could not be read) | Similar to Wompi. |

Guidance: payers mostly in Colombia → Wompi. Payers mostly abroad → a merchant-of-record service. PayPal only as a stopgap. The provider interface lets one start and another follow without touching League code.

Sources: [Stripe countries](https://stripe.com/global), [Polar countries](https://polar.sh/docs/merchant-of-record/supported-countries), [Polar fees](https://polar.sh/docs/merchant-of-record/fees), [Lemon Squeezy countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries), [Lemon Squeezy fees](https://docs.lemonsqueezy.com/help/getting-started/fees), [Paddle pricing](https://www.paddle.com/pricing), [Wompi quick start](https://docs.wompi.co/docs/colombia/inicio-rapido/), [Wompi events](https://docs.wompi.co/docs/colombia/eventos/).

## Verification

- Unit tests for every new engine rule, `error-copy.ts`, `video-links.ts`, `endOfDayInZone`, the write runner and the results computation.
- Component tests for the join screen, the three role panels and `NextStepCard`.
- The League chain test on develop, extended in each phase:

  ```bash
  RUN_DB_SMOKE=1 pnpm test src/lib/services/league/league-chain.smoke.test.ts
  ```

- Browser check per role at phone width with an injected session (sign-in is Google only; see "Testing notes" in [`docs/league.md`](../league.md)).
- Supabase security advisors on develop after `0011`.
- `pnpm build` stays database-free.
- Each phase updates `docs/league.md`, and where it applies `docs/architecture.md`, `docs/database.md` and `AGENTS.md`.

## Open points to settle when their phase starts

- Phase 5: the correction window (7 days) and the limit of 3 revisions are defaults; confirm them.
- Phase 6: the provider, and whether paid plans get a COP price.

## Not in this plan

- Transferring ownership or changing a member's role.
- Judges assigned per division.
- Adding a rider after the start order exists.
- User deletion rewriting old results: deleting an account cascades its scores, results and ledger rows.
- The duplicate `event_disciplines` table.
- A rate limiter shared across Worker isolates (today's limits are per isolate).
- Enforcing the content security policy (it is report-only).
- The same missing RLS on `game_realtime_signals`. Same fix, different module; worth a small separate change soon.
