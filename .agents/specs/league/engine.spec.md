# League engine spec

Source requirements: `.agents/specs/league/plan.league.spec.md`. Schema in `data-model.spec.md`; HTTP contracts in `api.spec.md`.

The engine has two halves:

1. **Pure domain** (`src/lib/league/definitions.ts`, `src/lib/league/engine.ts`) — no DB, no IO. State machines, capability math, scoring/ranking/points, quota/capacity checks. Fully unit-tested.
2. **Service** (`src/lib/services/league/`) — Drizzle-owned, games-style: every mutation in `withDbWrite` + `db.transaction` + `SELECT … FOR UPDATE` on the event row + `expectedVersion` OCC + fingerprint idempotency via `event_action_requests` + realtime signal + `queueTagRevalidate`. Services are the only writers of the event section (single-writer rule; the directory read path stays in the event repository).

## Business rules (2026-09-14)

### Scheduling advance window
- A community event's start date may be at most **2 months in the future** (`MAX_SCHEDULE_ADVANCE_MONTHS`), validated at creation and whenever `startDate` changes (`assertScheduleAdvanceWindow`; `start_at ≤ addMonths(now, 2)` — calendar-month arithmetic). Editorial (seed-origin) events are exempt.

### Payment gate (community events only)
- An event must have a **registered payment** — an active `event_payments` row (`paid`/`comped`) — within **3 days** of creation. Registering the **free plan is self-service** by the organizer (amount 0, provider `self`, immediately `paid`); paid plans create a `pending` row that an administrator marks `paid`/`comped`.
- States, computed lazily from `created_at` + active payment (no cron):
  - `pending` (day 0–3): everything enabled; UI shows the highlighted announcement with the deadline.
  - `locked` (day ≥ 3): `assertEventWritable` rejects every mutation except payment registration with `EVENT_LOCKED`; all features/data are read-only for every user of the event.
  - `disabled` (day ≥ 6): definitive; `assertPaymentWindowOpen` also rejects payment registration (`EVENT_DISABLED`). Only an administrator can intervene (marking a payment active revives the event since the gate is derived).
- `payment_due_at` / `payment_deadline_at` are persisted at creation (created_at + 3d / + 6d) for display and querying; the engine derives state from them consistently.
- Upgrading plans supersedes a free self-registration (marked `refunded`); a real active payment blocks new registrations (`PAYMENT_EXISTS`).
- Organizer notification = the highlighted in-app announcement (`PaymentGateNotice`, copy from `src/lib/league/notices.ts`) on event surfaces + the my-events list state. The notice is **lazy**: it renders whenever the organizer views the event — there is no proactive push at the lock boundary in v1 (no cron/worker; Phase-5 email reminders at day 2/3/6 close the proactive gap — documented decision 2026-09-16).

### Notification fan-out (in-app v1)

- League mutations fan out `user_notifications` rows **inside the same transaction** as the mutation (no queue, no PGMQ — the app has no resident worker; revisit triggers are recorded in `plan.league.spec.md`). Realtime delivery rides the `supabase_realtime` publication; a Phase-5 `pg_cron` sweep (approved decision) will add day-2/3/6 payment reminders + email delivery via Resend, computing gate states read-only — the lazy gate remains the source of truth.
- Recipient resolution is a service concern (`src/lib/notifications/`): active members by role from `event_memberships`, admins from the `league.manage` permission join. Copy/type constants live in `src/lib/notifications/definitions.ts` (pure, tested).

## Invariants

- One **active** membership per user per event (`event_memberships` partial unique). One active `main_organizer` per event. No role changes in v1 — removal + re-invite.
- The creator becomes the `main_organizer` membership at creation. The main organizer cannot be removed, cannot leave; they cancel the event instead. Only the main organizer removes other members.
- **Organizer capability includes judging** (covers the free tier where the organizer judges). Explicit `judge` members exist only on paid plans.
- All participants (riders, judges, organizers) must be signed in. No guest identity in league routes.
- Every state transition bumps `sport_events.version`; the response contract is `{ id, version }`.

## Lifecycle

```
draft ──open──▶ registration_open ──close──▶ registration_closed ──generate schedule──▶ scheduled
  │                                              │                                        │
  └───────────────────────── cancel ────────────┴───────────────────────────────────────▶ cancelled
                                       scheduled ──start──▶ live ──complete──▶ completed
                                                                  completed ──publish──▶ completed (+results_published_at)
```

- Transitions and actors:

| Action | From → To | Actor | Guards |
|---|---|---|---|
| open registration | draft → registration_open | main organizer / organizer | start_at in future |
| close registration | registration_open → registration_closed | organizer | — |
| generate schedule | registration_closed → scheduled | organizer | ≥1 active rider |
| start event | scheduled → live | organizer | schedule exists |
| complete event | live → completed | organizer | all runs scored or skipped |
| publish results | completed (or early from `live`) → completed + results_published_at | organizer | ≥1 result; publish atomically sets `status: completed` so a `live` event never carries frozen results; idempotent single publish |
| cancel | any pre-completed → cancelled | main organizer | sets cancelled_at |
| edit config | any pre-live | organizer | — |

- Directory/public status for editorial discovery stays date-derived (`deriveStatus`); league UIs read the stored lifecycle.

## Capabilities

| Capability | main_organizer | organizer | judge | rider |
|---|---|---|---|---|
| Edit event config / criteria | yes | yes | no | no |
| Add members, create/revoke invites | yes | yes (never the main organizer) | no | no |
| Remove members | yes (any) | no | no | no |
| Registration / schedule / start / complete / publish / force-close run | yes | yes | no | no |
| Cancel event | yes | no | no | no |
| Submit scores during an open window | yes | yes | yes | no |
| View organizer dashboard (live + historic metrics) | yes | yes | no | no |
| View own schedule / results / history | yes | yes | yes | yes |
| Leave event | no | yes | yes | yes |

## Plans, quotas, payments (manual)

- Effective plan = `sport_events.plan_slug` (starts `free`; unchanged until an admin marks a payment `paid`/`comped`).
- Account plan for quota = active `user_event_plans` row, else the default (`free`) plan. Quota check: count `sport_events` where `created_by = user AND origin = 'community'` in the **current UTC month** against `event_plans.monthly_event_limit` (8 free / 21 paid). Seed-origin events don't count.
- Feature gates: free = 1 organizer (judges implicitly), ≤3 riders, rider invites only, no judge/organizer invites, no separate judges. Paid = multi-organizer, judge + organizer invites, rider capacity per plan, historic metrics. `PAID_FEATURES` lives in `definitions.ts`.
- Payment flow: organizer requests upgrade → `event_payments` row `pending` (capacity NOT unlocked) → admin marks `paid` or `comped` → event `plan_slug` set + `user_event_plans` upserted (highest monthly limit wins) in the same transaction. `refunded`/`failed` never auto-downgrade an event or account; admins resolve manually.

## Invites & join

- Codes: 12-char base62 (`INVITE_CODE_LENGTH`), unique; per role (`organizer | judge | rider`); optional `expires_at` / `max_uses`; revocable. QR is rendered from the invite URL client-side (`qrcode.react`, reuse `ShareActions` pattern).
- Join (single transaction, event locked): signed-in user; code exists, not revoked/expired/exhausted; role joinable for event status (`registration_open` or `draft` with explicit join enabled? no — registration_open only; draft events join via direct organizer add); user has no active membership; capacity for the role not exceeded → insert membership (`joined_via_invite_id`) + increment `use_count`.
- Capacity counting: riders = active `rider` memberships; organizers = active `organizer` + the `main_organizer`; judges = active `judge` memberships. The organizer's implicit judging does not consume `max_judges`.

## Schedule

- Generate (at `generate schedule` transition): one `event_runs` row per active rider membership, ordered by `joined_at` then `user_id`; `sequence = 1..N`; `scheduled_at = start_at + (sequence-1) × slotMinutes` (input 5–120, default 10), computed in the event `timezone`; `schedule_published_at` set; signal `schedule_published`.
- Organizer may reorder / reschedule runs while `scheduled` (and while `live` for not-yet-judged runs). No background jobs exist in this repo: run progression is organizer-driven, never cron-based.

## Judging

- Start run (organizer): `status='judging'`, `window_started_at = now()`, `window_ends_at = now() + windowMinutes` (input 1–60, default 10); signal `run_started`.
- Score submit (judge-capable member): `{ runId, scores: {criterionKey: number}, expectedVersion, idempotencyKey }`; validation — run is `judging`, window open, every active criterion present, `0 ≤ score ≤ max_score`. Upsert `event_scores` (judges may revise until window end; `submitted_at` refreshed); signal `score_submitted`. After expiry → `RUN_WINDOW_CLOSED`; organizer may extend the window (`window` action).
- Scoring math (pure): judge total = `Σ(score × weight) / Σ(weight)`, rounded to 2 dp; run total = mean of submitted judge totals, rounded 2 dp; ≥ 1 score required.
- Close run (organizer): `status='scored'` from `judging` (allowed any time; expired windows close cleanly). A run with zero scores may be marked `skipped` instead.

## Ranking & points

- Rank all `scored` runs: `total_score` desc → best single judge total desc → lower run `sequence`; distinct ranks `1..N`.
- **Skipped runs are never ranked and get no `event_results` row**; their riders still attended — publish awards them attendance ledger points only. Runs still `judging`/`scheduled` at publish time are excluded entirely (no results, no attendance).
- Points constants (`definitions.ts`, product-tunable): attendance `10`; rank bonus 1st `100`, 2nd `80`, 3rd `60`, 4th `50`, 5th `40`, 6th+ `25`. The total stored in `event_results.points_awarded` for rank N is attendance + bonus; the `…:rank` ledger row stores the bonus above attendance. Ledger keys: `event:<id>:rider:<uid>:attended` and `event:<id>:rider:<uid>:rank`.
- Publish results (one transaction): freeze `event_results` rows for ranked runs only, insert ledger rows for every attending rider (`ON CONFLICT (event_key) DO NOTHING` — attendance for all, rank bonus for ranked), upsert `rider_stats` (`total_points`/`events_attended`/`events_won` incremental), set `results_published_at` + `status: completed` atomically, emit `results_published`, queue revalidation (`ranking:global`, `ranking:user:<uid>`, `events:item:<id>`), and notify ranked riders. A re-publish is rejected up front via `results_published_at` (idempotent single publish).

## Deletion / cancellation

- Organizer cancel: `status='cancelled'`, `cancelled_at`; runs left as-is (UI shows cancelled state). No automatic refunds.
- Hard delete stays admin-only via the existing content delete flow (cascade tears down all child tables).

## Domain errors

`LeagueDomainError` with codes (`src/lib/league/definitions.ts` `LeagueErrorCode`): `INVALID_TRANSITION, NOT_AUTHORIZED, STALE_VERSION, CAPACITY_EXCEEDED, QUOTA_EXCEEDED, ALREADY_MEMBER, INVITE_INVALID, INVITE_EXHAUSTED, PAYMENT_EXISTS, PAYMENT_NOT_FOUND, RUN_WINDOW_CLOSED, SCORE_INVALID, NOT_SCORED, EMPTY_SCHEDULE, EVENT_LOCKED, EVENT_DISABLED, SCHEDULE_TOO_FAR_AHEAD, IDEMPOTENCY_CONFLICT, RATE_LIMITED, INVALID_INPUT, PLAN_EXISTS, PLAN_NOT_FOUND, USER_NOT_FOUND` — mapped to HTTP statuses in `api.spec.md` (`IDEMPOTENCY_REUSE`/`IDENTITY_CONFLICT` are games-only and do not exist in the league taxonomy).
