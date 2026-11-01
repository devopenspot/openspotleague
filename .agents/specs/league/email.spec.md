# League email spec — Phase 5 (Resend + pg_cron)

Decisions fixed in `plan.league.spec.md`: provider = **Resend**, daily **`pg_cron` sweep** (no resident worker on Cloudflare Workers+Supabase, no PGMQ), **in-app notifications remain the source of truth** — the sweep reuses `user_notifications` rows instead of duplicating fan-out logic. Web push (VAPID) and one-click unsubscribe links are out of scope for v1.

## Shipped architecture

| Piece | Where | Notes |
|---|---|---|
| Email preferences | `0029_email_preferences.sql` | `user_email_preferences` (`user_id` PK → `auth.users` cascade, `email_digests_enabled` bool default **true**, owner RLS select/update) + `user_notifications.emailed_at` watermark + partial index on pending digest rows |
| Sweep plumbing | `0030_email_sweep.sql` | `pg_cron` + `pg_net` enabled; `league_email_log` (PK `(event_id, kind, day)`) dedupes payment reminders; `league_email_sweep()` SECURITY DEFINER with pinned `search_path = public, vault, extensions, cron, net` |
| Cron schedule | `0030` | job `league-email-sweep`, daily `17 9 * * *` → `select league_email_sweep()` (idempotent `DO` block) |
| Preference API | `GET/PUT /api/notifications/email-preferences` | session-gated; PUT body `{ emailDigests: boolean }` (`emailPreferencesInputSchema`) |
| Preference UI | `useEmailDigests` (`src/hooks/data/useNotifications.ts`) + `Emails on/off` toggle on `/notifications` | default-on; absent row = enabled |

### Sweep semantics (`league_email_sweep()`)

1. **Reads `resend_api_key` from Vault**; absent/empty → `RAISE NOTICE` and **return** (no side effects, no watermarking — so enabling the key later still sends the current 24h window).
2. `email_from` fallback `OpenSpot <onboarding@resend.dev>`; `app_public_url` fallback `https://openspot.app` (deep links are best-effort until set).
3. **Payment-gate reminders** to the event creator (`auth.users.email` via `sport_events.created_by`): community events with origin `community`, status not completed/cancelled, **no** `paid|comped` payment, age ≥ 2 / 3 / 6 days — **one email per event per run** (highest applicable un-sent day; no catch-up burst, 0032). Copy mirrors the engine gate math: 3d to register (free $0 self-registers), then locked, disabled at 6d; the day-6 notice directs creators to an administrator (self-revival is rejected by `assertPaymentWindowOpen`). User text is HTML-escaped (`league_escape_html`) before interpolation. Deduped via `league_email_log`.
4. **24h digest** per user: pending `user_notifications` rows (last 24h, `emailed_at IS NULL`) of types `league_registration_confirmed`, `league_schedule_published`, `league_event_started`, `league_event_cancelled`, `league_results_published`, `league_points_earned` (canonical subset: `EMAIL_DIGEST_TYPES` in `src/lib/notifications/definitions.ts`, guarded by a drift test; membership/invite-revocation/payment types stay in-app). Overlapping runs are serialized by a per-user transaction advisory lock (at-most-once per batch); watermarking happens **after** the enqueue call, and rows that age out of the 24h window un-emailed get a catch-up watermark (0032). pg_net is fire-and-forget — delivery failures are visible in `net._http_response`.

## Degradation contract (works without any secrets)

The in-app flow is complete with zero email dependency: events, join/invites, lifecycle, judging, results/points, admin payments/plans, bell + list + realtime + mark-read. The sweep no-ops safely. **No vault values are required for a usable system.**

| State | Behavior |
|---|---|
| No secrets set | Sweep returns early every run; no rows touched, no `emailed_at` watermarks, no UI change beyond the toggle defect fixed below |
| Only `resend_api_key` set | Emails flow with fallback from-address and `openspot.app` deep links (test env) |
| All three set | Full behavior |

## Feature detection (shipped — graceful degradation)

Goal: the system *knows* email is unconfigured and **excludes only the email feature** from the UI; everything else stays fully functional. The toggle is hidden rather than disabled (exclusion principle; a disabled-with-tooltip variant is the accepted alternative).

1. **`0031_email_delivery_status.sql`** (applied):
   - `CREATE FUNCTION league_email_delivery_available() RETURNS boolean` — `SECURITY DEFINER`, `STABLE`, `SET search_path = public, vault`.
   - Body: `to_regclass('vault.decrypted_secrets') IS NULL → false` (dev DBs without Vault), else `true` when a **non-empty** `resend_api_key` secret exists. Boolean presence only — never exposes the secret.
2. **Service** — `src/lib/notifications/service.ts`: `isEmailDeliveryAvailable(): Promise<boolean>` via `withDbRead` (`select league_email_delivery_available()`), called once per notifications-page mount.
3. **Route** — `GET /api/notifications/email-preferences` returns `{ emailDigests, deliveryAvailable }` (both service reads); **PUT unchanged** (saving the preference while email is off stays allowed — it becomes meaningful the day the key is added).
4. **Hook + UI** — `useEmailDigests` returns an added `deliveryAvailable: boolean | null` (`null` = unknown/anonymous); `NotificationsTab` renders the toggle **only when `deliveryAvailable === true`**.
5. **Constants/tests** — `FALLBACK_EXPECTED_MIGRATION_ID` now pins `"0033_league_hardening_indexes"` (`health.test.ts` asserts FALLBACK === filesystem tip; migrations 0032/0033 shipped after this phase's tables — see `data-model.spec.md`). Contract tests in `league-routes.test.ts` updated for the new GET payload.
6. Gates (`pnpm lint && pnpm typecheck && pnpm test && pnpm build`) → shipped in the same commit as this spec.

## Activation runbook (operator, manual — secrets are NEVER committed)

Run once per Supabase project in the SQL editor:

```sql
select vault.create_secret('<resend-api-key>', 'resend_api_key', 'Resend API key');
select vault.create_secret('OpenSpot <you@yourdomain.com>', 'email_from', 'From header');
select vault.create_secret('https://your-app-domain', 'app_public_url', 'Deep-link base');
```

You can test immediately after with:

```sql
select league_email_sweep();
```

Useful checks: `select league_email_delivery_available();` (should flip to `true`), `select * from league_email_log order by sent_at desc;` (reminder dedupe ledger), `select * from cron.job;` (schedule present). Rotating the key = update the secret in Vault; no code or migration changes.
