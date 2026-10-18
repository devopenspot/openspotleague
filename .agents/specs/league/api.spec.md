# League API spec

Schema in `data-model.spec.md`, engine rules in `engine.spec.md`. This doc fixes routes, contracts, auth, errors, realtime and caching.

## Conventions

- All `/api/league/**` mutations and private reads require a signed-in Supabase session (`requireUser`); no guest identities in league.
- Public directory reads (`/api/events*`) stay anonymous.
- Zod validation inline: `schema.safeParse(body)` → `400 { error, details: flatten() }`.
- Error mapping (league mirror of games' `DOMAIN_ERROR_STATUS`):
- 400 `INVALID_INPUT`, `SCORE_INVALID`, `SCHEDULE_TOO_FAR_AHEAD`
  - 401 bare "Authentication required"
  - 403 `NOT_AUTHORIZED`
  - 409 `STALE_VERSION`, `IDEMPOTENCY_CONFLICT`, `ALREADY_MEMBER`, `INVITE_EXHAUSTED`, `RUN_WINDOW_CLOSED`, `NOT_SCORED`, `EMPTY_SCHEDULE`, `CAPACITY_EXCEEDED`, `QUOTA_EXCEEDED`, `INVITE_INVALID`, `INVALID_TRANSITION`, `PAYMENT_EXISTS`, `EVENT_LOCKED`, `EVENT_DISABLED`, `PLAN_EXISTS`
  - 404 `PAYMENT_NOT_FOUND`, `PLAN_NOT_FOUND`, `USER_NOT_FOUND`
  - 429 `RATE_LIMITED`
  - 500 "Internal error" for anything unclassified (never echo raw messages)
- Invite lookup failures (unknown **and** known-but-unusable codes) all return 409 `INVITE_INVALID` — the join/preview service never distinguishes the two, so codes cannot be enumerated.
- League routes map service failures via `leagueErrorResponse` (`src/app/api/league/errors.ts`, shared with admin league routes; the repo-wide `mapMutationErrorResponse` applies to non-league admin content routes).
- Mutations on an existing event require `expectedVersion` (stale → 409 `STALE_VERSION`) and an `idempotencyKey` (UUID) in the body; replay returns the stored `{id, version}` response, fingerprint mismatch → 409 `IDEMPOTENCY_CONFLICT` (league canonical; `IDEMPOTENCY_REUSE`/`IDENTITY_CONFLICT` are games-only codes and deliberately unmapped here).
- Rate limits: identity bucket 60/min + IP bucket 120/min (`enforceRateLimit` parity with games); join endpoint gets an extra IP bucket 10/min.
- Success responses: mutations `{ id, version }` (validated by a `leagueMutationResponseSchema`), creates 201; private reads are uncached with `Cache-Control: private, no-cache` and ETag `"event-<id>-<version>"` + `?version=` short-circuit (304).

## Routes

```
POST   /api/league/events                       create (quota + 2-month advance window) → 201
GET    /api/league/events                       my events grouped by role/status incl. payment gate state
GET    /api/league/events/[id]                  role-aware state (payment notice + readOnly flag; ETag/304)
PATCH  /api/league/events/[id]                  config edit (gate-enforced)
POST   /api/league/events/[id]/payment          register plan payment (free self-serve; paid → pending)
PATCH  /api/admin/league/payments/[id]          mark paid/comped/refunded/failed (league.manage; POST accepted as alias)
POST   /api/league/events/[id]/registration/open
POST   /api/league/events/[id]/registration/close
POST   /api/league/events/[id]/schedule               generate (slotMinutes) or replace
PATCH  /api/league/events/[id]/schedule               reorder / reschedule runs (scheduled; live only while nothing is judged) — payload `runs` covers every run exactly once with contiguous sequences 1..N; `scheduled_at` re-derived from `start_at + (seq−1) × slotMinutes`
POST   /api/league/events/[id]/start
POST   /api/league/events/[id]/complete
POST   /api/league/events/[id]/cancel
POST   /api/league/events/[id]/results/publish
POST   /api/league/events/[id]/runs/[runId]/start     windowMinutes input
POST   /api/league/events/[id]/runs/[runId]/close     (or mark skipped)
POST   /api/league/events/[id]/runs/[runId]/window    extend window
POST   /api/league/events/[id]/runs/[runId]/scores    judge-capable, window-enforced
POST   /api/league/events/[id]/members                add member by userId (organizer/judge roles; paid features)
DELETE /api/league/events/[id]/members/[membershipId] main organizer only
POST   /api/league/events/[id]/leave
POST   /api/league/events/[id]/invites                create per-role invite
DELETE /api/league/events/[id]/invites/[inviteId]
GET    /api/league/invites/[code]                     preview: event summary + role (public, unauthenticated-safe minimal payload)
POST   /api/league/join                               join by code (signed-in)
GET    /api/league/events/[id]/dashboard              organizer live + historic metrics
GET    /api/league/events/[id]/history                rider/judge history for this user
GET    /api/notifications                             list (keyset: `?before=` cursor, `?limit` ≤ 50, `?unread=1`) + unreadCount (owner)
POST   /api/notifications/read                        mark read: { ids?: string[], all?: boolean }
GET    /api/admin/league/plans
POST   /api/admin/league/plans
PATCH  /api/admin/league/plans/[slug]
GET    /api/admin/league/payments                     (payment queue list)
PATCH  /api/admin/league/payments/[id]                (mark paid/comped/refunded/failed; POST accepted as alias)
GET    /api/admin/league/account-plans                (?search= grant search)
PATCH  /api/admin/league/account-plans                (grant/revoke user_event_plans)
```

- Admin league routes are gated by the new `league.manage` permission (added to `PERMISSION_SLUGS` + seed, granted to `admin`), guarded `requireCurationAccess`-style with `authorizationErrorResponse`; `leagueErrorResponse` for service failures.
- `PATCH`/`POST /api/admin/league/payments/[id]` body: `{ status: 'paid' | 'comped' | 'refunded' | 'failed', providerReference? }` (`leagueAdminPaymentActionSchema`); refunds/failed never auto-downgrade an event or account.
- `PATCH /api/admin/league/account-plans` body: `{ userId, planSlug?, action: 'grant' | 'revoke' }` (`leagueAccountPlanActionSchema`; action defaults to `grant`, `planSlug` required to grant). Revoked users fall back to the default/free caps.
- `GET /api/notifications` always returns `{ items, unreadCount, nextCursor }` with copy rendered server-side (`renderNotification`); the bell badge reads `unreadCount` (also present on `?unread=1`).
- Public `/api/events`, `/api/events/[id]`, `/api/events/featured` keep their contracts, with the DTO gains below.
- `PERMISSION_SLUGS` gains `league.manage` ("Manage league settings": plans, payments, account grants). Content curation permissions are unchanged.

## DTOs

- `SportEvent` (public): gains `origin ('seed'|'community')`, `visibility`, `lifecycleStatus`, `timezone`, `category` (+`categoryName`), `spotName?`; `tier`→`category` rename everywhere (`tierName`→`categoryName`); `url` becomes nullable.
- `MapEvent`: same projection rules, `category`/`categoryName` fields.
- League state payloads (role-aware): event core + my membership/role + counts per role + plan/capacity info; organizer state adds runs with score summaries, invites, payments; judge state adds all event runs + judging windows + own submissions (`myJudgements` — there is no judge↔run assignment in v1); rider state adds own runs/scores/results.
- League create input: `imageUrl` optional — the server falls back to the default event image (`DEFAULT_EVENT_IMAGE`); `sport_events.image_url` stays NOT NULL.
- Zod contracts in `src/lib/schemas/league.ts` (inputs) and `src/lib/schemas/event.ts` (public DTO).

## Realtime

- Signal flow: the service is the **single signal writer** into `event_realtime_signals` (0033 dropped the `emit_event_realtime_signal` DB trigger — its generic row always lost `ON CONFLICT DO NOTHING` to the typed service row written at the same `(event_id, version)`; editorial/admin content edits therefore emit no generic signal and consoles recover via STALE_VERSION refetch); Supabase browser channel `league:event:<id>` on `postgres_changes` filtered `event_id=eq.<id>`; on signal, debounced (75 ms) authorized refetch of `/api/league/events/[id]?version=N`; monotonic version guard rejects `incoming.version <= current`; polling fallback 2 s → 30 s cap, 5 s channel-stall grace, visibility pause/resume. All league viewers are signed in, so channels are used everywhere (no guest polling path).
- `src/lib/league/realtime.ts` + `src/components/league/hooks/useLeagueRealtime.ts` / `useLeagueAction.ts` (copied patterns from games; games code untouched).
- Notifications channel: `user:<uid>` on `postgres_changes` filtered `user_id=eq.<uid>` against `user_notifications` (publication entry in 0028); bell refetches `/api/notifications?unread=1` on insert (debounced), poll-on-focus fallback; `useNotifications.ts` hook.

## Notifications fan-out (v1, in-app only)

- `createNotifications(tx, rows)` is invoked inside the same `withDbWrite` transaction as the triggering mutation (next to the signal insert). No queue/worker (no PGMQ — see plan decisions).
- Trigger map: invite revoked → recipients already consumed it (best-effort: users who joined via that invite); member added/removed → recipient (+ co-organizers for removals); registration confirmed (self-join) → recipient + organizers; schedule published / event started / cancelled → all active members; results published → ranked riders (with points/rank payload); points ledger insert → recipient; payment registered (free self-serve or admin marked paid) → organizers; paid-plan payment registered → `league.manage` holders (admin queue alert). No invite-created notification exists — invites are per-role shared codes, not user-addressed.
- Copy rendering is pure (`src/lib/notifications/definitions.ts`) so route payloads and UI stay in sync; `payload` carries ids/slugs for deep links.
- Notification types (v1): `league_invite_revoked`, `league_registration_confirmed`, `league_member_added`, `league_member_removed`, `league_schedule_published`, `league_event_started`, `league_event_cancelled`, `league_results_published`, `league_points_earned`, `league_payment_registered`, `league_payment_pending_admin`.

## Caching

- Public reads: `use cache` + `cacheTag("events:list" | "events:featured" | "events:item:<id>")` + `cacheLife` profiles from `src/lib/cache/lifetimes.ts`.
- Mutations invalidate via the extended `revalidateEventCaches` (adds `events:item:<id>` already present) and `revalidatePath` for `/sport-events`, `/sport-events/<slug>`, `/explore`, admin paths; engine mutations additionally `queueTagRevalidate` inside `withDbWrite` for ranking/profile tags (`ranking:global`, `ranking:user:<id>`, `profile:*`) flushed after commit.
- Participant/live reads are never cached; they are ETag/version-gated.
