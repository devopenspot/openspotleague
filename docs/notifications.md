# Notifications

League participants (riders, judges, organizers) get notifications in two channels:

- **In-app**: the bell and `/notifications`, live over Supabase Realtime. Always on.
- **Email**: AWS serverless delivery (SQS FIFO → Lambda → Resend free plan), capped so it stays free. Users control it per category.

Push and SMS are not built. Web Push (VAPID, free) is the natural next channel: the queue message already carries `channel: "email"`, so a `webpush` consumer can be added without a new contract. SNS Mobile Push does not apply because OpenSpot has no native app.

## Flow

```
League mutation ── withDbWrite tx ── createNotifications() → user_notifications
                     │ commit                    (email_status = 'pending' when EMAIL_POLICY says so)
                     ▼ queueAfterCommit (ctx.waitUntil on Workers)
     dispatcher: claim pending → queued, load prefs + profiles.email, render,
                 reserve the daily email budget (over budget → back to pending), SigV4 (aws4fetch)
                     │ SendMessageBatch
                     ▼
     SQS FIFO osl-notify-email.fifo  (group = user, dedup = job key, DLQ after 5 tries)
                     ▼
     λ osl-notify-email-sender ── DynamoDB idempotency (24 h) ── Resend API (Idempotency-Key,
                     │                                           List-Unsubscribe one-click)
                     │ signed POST /api/internal/notifications/delivery → 'sent' / 'failed' /
                     │   'deferred' (Resend quota used up: rows back to pending, today's budget closed)
     Resend webhook (bounced, complained) → λ osl-notify-resend-events (Function URL, Svix
                     signature) → same route → suppress the address

     EventBridge Scheduler rate(15 min) → λ osl-notify-tick → signed POST /api/internal/notifications/tick
       1. reminders (inserted with a unique dedupe_key, immediate ones queued after commit)
       2. backstop: pending rows past their max age are dropped; then immediate rows still
          pending after 2 min and queued rows unreported after 1 h are sent again
       3. digests: pending digest rows created before the latest 17:00 UTC boundary,
          one email per user and category, so at most one digest a day each
```

AWS never connects to Postgres. The Worker does all data access through Hyperdrive; the Lambdas only send email and call back two signed routes.

## Code map

| Path | Role |
| --- | --- |
| `src/lib/notifications/definitions.ts` | `EMAIL_POLICY` (urgency + category per type), copy (`renderNotification`), deep links. |
| `src/lib/notifications/service.ts` | `createNotifications` (in-transaction writer, outbox status, after-commit hand-off), preferences. |
| `src/lib/notifications/reminders.ts` | Pure reminder selection (video deadline, judging backlog, payment gate). |
| `src/lib/notifications/contest-changes.ts` | Which contest edits notify members (`league_contest_updated`). |
| `src/lib/notifications/delivery/contract.ts` | Queue message and delivery report schemas, HMAC signing. Shared with `infra/aws` by relative import: keep it free of `@/` imports. |
| `src/lib/notifications/delivery/dispatcher.ts` | Claimed rows → email jobs (skips, digests, retries, max age). Dependencies injected; unit-tested. |
| `src/lib/notifications/delivery/sender-batch.ts` | The sender Lambda's batch loop (retry, permanent failure, quota deferral, per-user order). Same import rule as `contract.ts`; unit-tested. |
| `src/lib/notifications/delivery/resend-request.ts` | Resend request (headers, idempotency key) and status → outcome rules. Same import rule; unit-tested. |
| `src/lib/notifications/delivery/webhook-signature.ts` | Resend (Svix) webhook signature check and event → suppression mapping. Same import rule; unit-tested. |
| `src/lib/notifications/delivery/budget.ts` | Daily and monthly email caps (`allowEmails`), pure; applied by `store.reserveEmailBudget` under a row lock. |
| `src/lib/notifications/realtime.ts` | Which realtime changes make the inbox refetch (outbox updates do not). |
| `src/lib/notifications/delivery/store.ts` | Outbox claims, the email budget (`notification_email_budget`, 0011), recipients, suppression, reminder candidate reads. |
| `src/lib/notifications/delivery/service.ts` | Tick, delivery reports, unsubscribe. |
| `src/app/api/internal/notifications/{tick,delivery}` | Signed Lambda callbacks (`x-osl-timestamp`, `x-osl-signature`, 5 min window). The signature covers the route path and the body. |
| `src/app/api/notifications/unsubscribe` | GET verifies the link and shows a confirm button naming the category; POST (button or RFC 8058 one-click) turns the category off. |
| `infra/aws/` | CDK stack and the three Lambdas (sender, tick, Resend events). |

## Email policy

Edit `EMAIL_POLICY` to change what emails. `immediate` sends within seconds of the commit; `digest` batches into one email a day per user and category (the first tick after 17:00 UTC, `DIGEST_HOUR_UTC`); `null` stays in-app only.

| Category | Immediate | Digest | In-app only |
| --- | --- | --- | --- |
| `contest_updates` | event cancelled, event started | registration confirmed, member added, schedule published, registration opened / closed, contest updated | invite revoked, member removed |
| `reminders` | video deadline within 24 h, judging backlog (day 1, 3 and 7), payment gate (day 2 lock, day 5 disable) | | |
| `judging` | | video submitted (to judges), scoring complete (to organizers) | |
| `results` | results published (riders with rank and points; judges and organizers without) | | points earned |
| none | | | payment registered, payment awaiting review |

A digest lists at most 12 notifications; the rest are a count with a link to the inbox.

## Outbox states (`user_notifications.email_status`)

Rows enter the outbox only while delivery is configured. With email off, `email_status` stays `null` and the notification is in-app only, so switching email on never sends old mail.

| State | Meaning |
| --- | --- |
| `null` | In-app only: the type does not email, or delivery was off when the row was created. |
| `pending` | Waiting for the after-commit push (immediate) or the daily digest run, or returned after a failed enqueue, an exhausted email budget, or a Resend quota refusal. |
| `queued` | Claimed and sent to SQS (`email_queued_at`). Re-sent after 1 h without a report; the sender's idempotency prevents a second email. |
| `sent` | Resend accepted it (`emailed_at`). |
| `skipped` | No address, suppressed, the user turned the category off, or the row waited too long (immediate over 6 h, digest over 48 h; for example after an outage or a used-up email budget). |
| `failed` | Resend rejected it permanently (400/422), or no report within 24 h. |
| `bounced` | Reserved for per-row bounce reporting; today bounces suppress the address instead. |

Reminders carry `dedupe_key` (unique), so a tick that runs twice notifies once:

- Video deadline: `vdl24:<event>:<user>:<deadline ms>`. The deadline is in the key, so moving it reminds again. The email shows the deadline in the contest's time zone.
- Judging backlog: `jdg:<event>:<judge>:<oldest waiting video ms>:<day>`. A judge is reminded on day 1, 3 and 7 of their oldest waiting video, then left alone. Scoring it restarts the count from the next oldest.
- Payment gate: `pay:<event>:<lock|disable>`.

`league_scoring_complete` uses `scored:<event>:<user>` for the same reason.

The inbox hooks ignore realtime UPDATEs on unread rows (`shouldRefreshOnChange`): those are outbox status changes, not something the inbox shows.

## Preferences

`user_email_preferences` holds four booleans (`contest_updates`, `reminders`, `judging`, `results`, default on) plus `suppressed_at` / `suppressed_reason` from Resend bounce and complaint feedback. Turning any category on lifts a suppression. `email_digests_enabled` is deprecated (backfilled into the categories by 0009) and will be dropped by a later migration.

## Cost

The stack is built to cost $0. Email goes through **Resend's free plan** (3,000 emails a month, 100 a day, no card): over quota Resend refuses with a 429 instead of billing. Everything on AWS is inside the always-free tier, which applies on both the Free and the Paid account plan. SES is not used: it has no free tier for accounts created after 2026-07-21. Figures were measured on 2026-11-11, with the stack idle.

| Service | Use | Free allowance | Measured |
| --- | --- | --- | --- |
| Resend | every email | 3,000 a month, 100 a day | capped by the app at 95 / 2,900 |
| Lambda | about 3,000 tick runs a month plus one run per email batch and per webhook | 1M requests, 400k GB-seconds a month | under 1% |
| SQS | mostly Lambda polling the empty queue (two pollers while `maxConcurrency` is set) | 1M requests a month | 6 empty receives a minute ≈ 260k a month |
| DynamoDB | idempotency table, provisioned at 5 read / 5 write units (on-demand is not free) | 25 units each, 25 GB | 5 / 5 units |
| EventBridge Scheduler | 2,880 runs a month | 14M a month | under 0.1% |
| SNS, CloudWatch (2 of 10 alarms), Budgets (2 action budgets free), SSM standard parameters, KMS, Lambda Function URL | negligible; the Lambdas cache SSM values per container | covered | — |
| CDK bootstrap bucket | Lambda bundles at deploy time | — | lifecycle rule deletes them after 1 day |

### Email budget

The Worker reserves room in `notification_email_budget` (one row per UTC day) before anything enters SQS, so mail over budget costs no queue or Lambda request either.

- `NOTIFY_EMAIL_DAILY_CAP` (default 95) and `NOTIFY_EMAIL_MONTHLY_CAP` (default 2,900) sit under Resend's 100 and 3,000; a 31-day month at 100 a day would pass 3,000.
- Immediate mail may use the whole cap. Digests stop at 60% of either cap, so the rest stays for "event started", results and reminders.
- Over budget, the row stays `pending` and the in-app notification is unaffected. Immediate rows expire after 6 h; digests wait for the next day's run (max age 48 h).
- If Resend refuses for quota anyway, the sender reports `deferred`: the rows go back to `pending` and today's budget is closed until 00:00 UTC.

Rough volume: a rider gets about 6 emails per contest, a judge about 8, an organizer about 7 (with daily digests). A 20-rider, 3-judge contest is about 105–150 emails, so the free plan covers roughly 20 such contests a month, and about 4 contests starting or publishing results on the same day.

### Zero-cost guard

The stack's budget `osl-notify-zero-cost` excludes credits, so any real charge counts. At an actual cost above $0.01, its budget action attaches `osl-notify-zero-cost-stop` (deny everything) to the three Lambda roles, the scheduler role and `osl-worker-notify`, and emails the alert address. That stops the whole stack until someone removes the policy (runbook below). Budget data lags up to about 12 hours, so the guard stops a leak within a day; it is not instant. `osl-notify-monthly` (default $1, alert at 50%) stays as an early warning.

### The account plan

This AWS account is on the **Free plan**, which ends on **2027-03-22**. AWS then suspends the account (email stops) and deletes it 90 days later. Upgrade to the Paid plan before then (Billing and Cost Management → Upgrade plan). The always-free limits above still apply, the remaining credits carry over, and the zero-cost guard is what keeps the Paid plan at $0.

## Setup

1. **Resend.** Create a free account (no card) and add the sending domain (`mail.<domain>`). Add the DNS records Resend shows in Cloudflare, all DNS only: the DKIM TXT `resend._domainkey.mail` and the MX and SPF TXT on `send.mail`. A strict DMARC policy on the parent domain passes, because DKIM signs as the From domain. Create an API key with sending access only, limited to that domain.
2. **SSM SecureStrings** (never in the template or in chat):
   - `/openspot/notifications/internal-secret`: random, 32+ bytes.
   - `/openspot/notifications/resend-api-key`: the Resend API key.
3. Install and synth: `pnpm aws:install`, then `pnpm aws:synth -c fromAddress="OpenSpot League <no-reply@mail.<domain>>" -c appUrl=https://<worker>.workers.dev -c alertEmail=<you>`. Add `-c replyTo=<inbox>` so replies reach someone; without it a reply to the no-reply address bounces. The infra package reuses the root `esbuild` and `tsx`, so run `pnpm install` at the root first. Use the Worker's `workers.dev` address as `appUrl`: Bot Fight Mode on a Free zone blocks the Lambdas on the custom domain and cannot be skipped by a rule.
4. Once per account and region: `pnpm --dir infra/aws exec cdk bootstrap`. Then add a lifecycle rule to the bootstrap bucket that expires current and noncurrent objects after 1 day.
5. `pnpm aws:deploy` with the same `-c` values.
6. **Resend webhook.** Create one for `email.bounced` and `email.complained` pointing at the stack output `ResendWebhookUrl`. Save its signing secret as SSM SecureString `/openspot/notifications/resend-webhook-secret`.
7. Confirm the alarm subscription email (it also receives the zero-cost guard notice).
8. Create an access key for the `osl-worker-notify` IAM user (its only permission is `sqs:SendMessage` on the queue).
9. Put these in `.env.local`, then deploy the Worker with `OPENSPOT_NOTIFICATIONS=1` (the production release workflow sets it; break-glass: `OPENSPOT_NOTIFICATIONS=1 pnpm build:production && OPENSPOT_NOTIFICATIONS=1 pnpm deploy:production`):
   - `AWS_NOTIFY_ACCESS_KEY_ID`, `AWS_NOTIFY_SECRET_ACCESS_KEY`, `AWS_NOTIFY_REGION` (us-east-1)
   - `NOTIFY_EMAIL_QUEUE_URL` (stack output `QueueUrl`)
   - `NOTIFICATIONS_INTERNAL_SECRET` (same value as the SSM parameter)
   - `NOTIFICATIONS_UNSUBSCRIBE_SECRET` (another random value)
   - Optional: `NOTIFY_EMAIL_DAILY_CAP`, `NOTIFY_EMAIL_MONTHLY_CAP` (defaults 95 and 2,900). These are not in `notificationSecretNames`; add them there first if you set them.

   Once email is permanently on, move the names from `notificationSecretNames` into `secretNames` in `cloudflare.config.ts` and drop the flag.

10. Run the tick once (invoke `osl-notify-tick`) and read the result: it should hold the tick counts. A 403 or an HTML page means Cloudflare blocked it (check `appUrl`).

Without all six variables delivery is off: the email toggles are hidden and new notifications stay in-app only.

### Rollout order

Apply migrations 0009, 0010 and 0011 first, then deploy the Worker straight away. The new code needs the 0009 columns, and the old code calls a database function that 0009 drops, so the old email-preferences request fails until the new Worker is live. 0009 cannot be undone: it drops the retired pg_cron email sweep.

## Runbook

- **DLQ alarm** (`osl-notify-email-dlq-not-empty`). Emails failed five times. Read the sender logs (`/aws/lambda/osl-notify-email-sender`); they hold error names and job keys, never addresses. Account-wide Resend problems (revoked API key, domain not verified) land here on purpose. Fix the cause, then redrive the DLQ from the SQS console. Redriven jobs keep their keys, so already-sent emails are not repeated. Emails that waited over 24 hours were already marked `failed` in the app.
- **Tick alarm** (`osl-notify-tick-failing`). Three of the last four ticks failed, so reminders, digests and retries have stopped. Read `/aws/lambda/osl-notify-tick`: a 401 means the internal secret differs between SSM and the Worker; a 403 or HTML means Cloudflare is blocking AWS (setup step 3); a 5xx means the Worker or database is down. Nothing is lost for 6 hours (immediate) or 48 hours (digest); older rows are dropped rather than sent late.
- **Rotate the Worker key.** Create a second key for `osl-worker-notify`, update the Worker secrets, deploy, then delete the old key. Do this every 90 days and at once if `.env.local` may have leaked: whoever holds this key can put messages on the queue, and the sender emails whatever is on the queue from your domain.
- **Rotate the internal secret.** Update the SSM parameter and `NOTIFICATIONS_INTERNAL_SECRET` together; Lambdas re-read the parameter after a 401.
- **Unsubscribe secret.** Do not rotate `NOTIFICATIONS_UNSUBSCRIBE_SECRET` without a reason: every unsubscribe link in mail already sent stops working.
- **Email budget used up.** Normal on a busy day: immediate rows wait up to 6 h, digests until the next day's run. Check `select * from notification_email_budget order by day desc limit 7`. Raising the caps above Resend's free quota only turns emails into `deferred` reports.
- **Zero-cost guard fired** (email "AWS Budgets: osl-notify-zero-cost"). The stack is stopped: every Lambda and the Worker's queue access are denied. Find the charge in Billing → Bills, fix the cause, then detach `osl-notify-zero-cost-stop` from the roles and the `osl-worker-notify` user (Budgets → `osl-notify-zero-cost` → Actions → reverse, or IAM). Rows that waited too long are dropped, not sent late.
- **Resend webhook failing.** Resend shows the delivery attempts. A 401 from the Function URL means the signing secret in SSM differs from Resend's; a 500 means the Worker refused the report (internal secret or Worker down). Resend retries with backoff.
- **Rotate the Resend key.** Create a new key in Resend, update `/openspot/notifications/resend-api-key`, then revoke the old one. The sender re-reads the parameter after a 401.
- **Stop all email.** Remove `NOTIFY_EMAIL_QUEUE_URL` from the Worker, or disable the Scheduler schedule and the SQS event source mapping.
