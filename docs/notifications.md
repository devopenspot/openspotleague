# Notifications

League participants (riders, judges, organizers) get notifications in two channels:

- **In-app**: the bell and `/notifications`, live over Supabase Realtime. Always on.
- **Email**: AWS serverless delivery (SQS FIFO → Lambda → SES). Users control it per category.

Push and SMS are not built. Web Push (VAPID, free) is the natural next channel: the queue message already carries `channel: "email"`, so a `webpush` consumer can be added without a new contract. SNS Mobile Push does not apply because OpenSpot has no native app.

## Flow

```
League mutation ── withDbWrite tx ── createNotifications() → user_notifications
                     │ commit                    (email_status = 'pending' when EMAIL_POLICY says so)
                     ▼ queueAfterCommit (ctx.waitUntil on Workers)
     dispatcher: claim pending → queued, load prefs + profiles.email, render, SigV4 (aws4fetch)
                     │ SendMessageBatch
                     ▼
     SQS FIFO osl-notify-email.fifo  (group = user, dedup = job key, DLQ after 5 tries)
                     ▼
     λ osl-notify-email-sender ── DynamoDB idempotency (24 h) ── SES v2 (List-Unsubscribe one-click)
                     │ signed POST /api/internal/notifications/delivery → 'sent' / 'failed'
     SES bounce/complaint → SNS → λ osl-notify-ses-events → same route → suppress the address

     EventBridge Scheduler rate(15 min) → λ osl-notify-tick → signed POST /api/internal/notifications/tick
       1. reminders (inserted with a unique dedupe_key, immediate ones queued after commit)
       2. backstop: immediate rows still pending after 2 min; queued rows unreported after 1 h
       3. digests: every pending digest row, one email per user and category
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
| `src/lib/notifications/delivery/dispatcher.ts` | Claimed rows → email jobs (skips, digests, retries). Dependencies injected; unit-tested. |
| `src/lib/notifications/delivery/store.ts` | Outbox claims, recipients, suppression, reminder candidate reads. |
| `src/lib/notifications/delivery/service.ts` | Tick, delivery reports, unsubscribe. |
| `src/app/api/internal/notifications/{tick,delivery}` | Signed Lambda callbacks (`x-osl-timestamp`, `x-osl-signature`, 5 min window). |
| `src/app/api/notifications/unsubscribe` | GET shows a confirm button; POST (button or RFC 8058 one-click) turns the category off. |
| `infra/aws/` | CDK stack and the three Lambdas. |

## Email policy

Edit `EMAIL_POLICY` to change what emails. `immediate` sends within seconds of the commit; `digest` batches into the next 15-minute tick; `null` stays in-app only.

| Category | Immediate | Digest | In-app only |
| --- | --- | --- | --- |
| `contest_updates` | event cancelled, event started | registration confirmed, member added, schedule published, registration opened / closed, contest updated | invite revoked, member removed |
| `reminders` | video deadline in 24 h, judging backlog (daily), payment gate (day 2 lock, day 5 disable) | | |
| `judging` | | video submitted (to judges), scoring complete (to organizers) | |
| `results` | results published (riders with rank and points; judges and organizers without) | | points earned |
| none | | | payment registered, payment awaiting review |

## Outbox states (`user_notifications.email_status`)

| State | Meaning |
| --- | --- |
| `null` | In-app only type. |
| `pending` | Waiting for the after-commit push (immediate) or the tick (digest), or returned after a failed enqueue. |
| `queued` | Claimed and sent to SQS (`email_queued_at`). Re-sent after 1 h without a report; the sender's idempotency prevents a second email. |
| `sent` | SES accepted it (`emailed_at`). |
| `skipped` | No address, suppressed, or the user turned the category off. |
| `failed` | SES rejected it permanently, or no report within 24 h. |
| `bounced` | Reserved for per-row bounce reporting; today bounces suppress the address instead. |

Reminders carry `dedupe_key` (unique), for example `vdl24:<event>:<user>` or `jdg:<event>:<user>:<yyyy-mm-dd>`, so a tick that runs twice notifies once. `league_scoring_complete` uses `scored:<event>:<user>` for the same reason.

## Preferences

`user_email_preferences` holds four booleans (`contest_updates`, `reminders`, `judging`, `results`, default on) plus `suppressed_at` / `suppressed_reason` from SES feedback. Turning any category on lifts a suppression. `email_digests_enabled` is deprecated (backfilled into the categories by 0008) and will be dropped by a later migration.

## Free tier

At League scale (under 20 contests a month) everything is inside the AWS always-free tier: Lambda, SQS, SNS, EventBridge Scheduler, DynamoDB, CloudWatch (1 alarm), Budgets. SES is free for 3,000 messages a month during the account's first 12 months, then $0.10 per 1,000. The stack creates a monthly budget (default $1, alert at 50%).

## Setup

1. Install and synth: `pnpm aws:install`, then `pnpm aws:synth -c sendingDomain=mail.<domain> -c fromAddress="OpenSpot League <no-reply@mail.<domain>>" -c appUrl=https://<app> -c alertEmail=<you>`. The infra package reuses the root `esbuild` and `tsx`, so run `pnpm install` at the root first.
2. Once per account and region: `pnpm --dir infra/aws exec cdk bootstrap`.
3. Create the internal secret (never in the template): `aws ssm put-parameter --name /openspot/notifications/internal-secret --type SecureString --value <random 32+ bytes>`.
4. `pnpm aws:deploy` with the same `-c` values.
5. In Cloudflare DNS (DNS only, not proxied), add the stack outputs: the three DKIM CNAMEs, the `bounce.` MX and SPF TXT, and `_dmarc.<domain>` TXT `v=DMARC1; p=none; rua=mailto:<you>`.
6. Request SES production access in the console (about 24 h). Until then SES only delivers to verified addresses.
7. Confirm the alarm subscription email.
8. Create an access key for the `osl-worker-notify` IAM user (its only permission is `sqs:SendMessage` on the queue).
9. Put these in `.env.local`, then deploy the Worker with `OPENSPOT_NOTIFICATIONS=1 pnpm deploy:secrets`:
   - `AWS_NOTIFY_ACCESS_KEY_ID`, `AWS_NOTIFY_SECRET_ACCESS_KEY`, `AWS_NOTIFY_REGION` (us-east-1)
   - `NOTIFY_EMAIL_QUEUE_URL` (stack output `QueueUrl`)
   - `NOTIFICATIONS_INTERNAL_SECRET` (same value as the SSM parameter)
   - `NOTIFICATIONS_UNSUBSCRIBE_SECRET` (another random value)

   Once email is permanently on, move the names from `notificationSecretNames` into `secretNames` in `cloudflare.config.ts` and drop the flag.

Without these variables delivery is off: the email toggles are hidden and rows stay `pending`.

## Runbook

- **DLQ alarm.** Read the sender logs (`/aws/lambda/osl-notify-email-sender`), fix the cause, then redrive the DLQ from the SQS console. Redriven jobs keep their keys, so already-sent emails are not repeated.
- **Rotate the Worker key.** Create a second key for `osl-worker-notify`, update the Worker secrets, deploy, then delete the old key. Do this yearly.
- **Rotate the internal secret.** Update the SSM parameter and `NOTIFICATIONS_INTERNAL_SECRET` together; Lambdas re-read the parameter after a 401.
- **Stop all email.** Remove `NOTIFY_EMAIL_QUEUE_URL` from the Worker, or disable the Scheduler schedule and the SQS event source mapping.
