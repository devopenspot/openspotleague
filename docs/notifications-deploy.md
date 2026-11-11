# Deploy guide: production database and email notifications

A step-by-step guide to take the notifications module live. It also covers the first production database setup, because the two happen together. For how the module works, see [`notifications.md`](notifications.md). For database commands, see [`database.md`](database.md).

Written 2026-11-10 for branch `claude/contest-notification-module-eccf29` (migrations `0009_notification_delivery`, `0010_event_signal_trigger_deferred` and `0011_notification_email_budget`). Updated 2026-11-11: email moved from SES to Resend's free plan, so the whole stack stays at $0.

## Where things stand

| Item | State on 2026-11-10 |
| --- | --- |
| Deployed Worker `open-spot` | Its Hyperdrive config `open-spot-db` points at the **develop** Supabase project. The live site runs on the develop database. |
| Production Supabase project | New. No schema, no data, not connected to any Worker. |
| `.env.local` | Points at develop. |
| Migrations 0009, 0010, 0011 | Not applied anywhere. |
| AWS stack `OpenSpotNotifications` | Not deployed. |

**Progress (2026-11-10).** Stage 1 is done: develop has 0009 and 0010, the gate and the League chain test passed, the Worker runs the branch code, and the 0010 signal check passed. Stage 4 is nearly done: CDK is bootstrapped, the SSM secret exists, the stack is deployed with `appUrl` on `workers.dev` and the tick paused, the DNS records are in Cloudflare, and SES shows DKIM and MAIL FROM verified. SES production access is granted (50,000 emails a day, 14 a second).

**Change (2026-11-11).** SES has no free tier for this account, so email now goes through Resend's free plan (3,000 a month, 100 a day, no card), with an app-side daily cap and a zero-cost guard (see [`notifications.md`](notifications.md#cost)). Stage 4 below is the Resend version; the SES identity, configuration set and DNS records are removed. Still waiting: the alarm subscription confirmation and the Resend account. CDK ran with the root user's credentials; replace them with an admin user and delete the root access key.

Two facts shape the order below:

- **0009 cannot be undone.** It drops the retired pg_cron email sweep.
- **Old code breaks on a database that has 0009.** The Worker code on `main` calls a function 0009 drops, so its email-preferences request fails until the new Worker is live. Wherever you apply 0009, deploy the new Worker right after.

## The stages

| Stage | What | Result |
| --- | --- | --- |
| 0 | Prepare: passwords, env files, safety checks | You always know which database a command will hit |
| 1 | Develop: apply the migrations, test, deploy the new code on develop | The new code is proven on the live URL, email still off |
| 2 | Merge to `main` | One source of truth |
| 3 | Production database: schema, seed, sign-in, connect the Worker | The live site runs on production, email still off |
| 4 | AWS stack and Resend: domain, DNS, keys, webhook | Email infrastructure ready, at $0 |
| 5 | Switch email on | Notifications send email |
| 6 | Verify | Proof that each part works |
| 7 | After: cleanup, rotation, rollback notes | Operations |

Stages 1 to 3 need no AWS. Stage 4 does not block them.

## Stage 0: prepare

### 0.1 Rotate the production database password

The production database password was shared in a chat on 2026-11-10. Reset it in the Supabase dashboard (Project Settings → Database) before going on, and use only the new one below.

### 0.2 One env file per environment

Every CLI script reads `.env.local` and nothing else (`src/db/load-env.ts`, `scripts/deploy-with-secrets.ts`), and `.env.local` overrides variables exported in the shell. So the file that is in place decides the target.

Keep two complete files next to it. Both are ignored by git (`.env*`).

| File | Holds |
| --- | --- |
| `.env.develop.local` | Everything for the develop project. This is today's `.env.local`. |
| `.env.production.local` | The same variable names with production values. |

Activate one by copying it:

```bash
cp .env.develop.local .env.local
```

```bash
cp .env.production.local .env.local
```

### 0.3 Check the target before every database or deploy command

This prints only the host of the active database, never the password:

```bash
node -e "const e=require('dotenv').parse(require('fs').readFileSync('.env.local'));console.log(new URL(e.SUPABASE_DIRECT_URL).host, '|', e.NEXT_PUBLIC_SUPABASE_URL)"
```

Rules while the production file is active:

- Do not run `pnpm dev` or `pnpm start`. Local development against production spends its egress budget (see [`caching-and-egress.md`](caching-and-egress.md)).
- Never run `pnpm db:reset`, `pnpm db:fresh` or `pnpm db:fresh:seed`. They drop every application table.
- Copy the develop file back as soon as the stage is done.

### 0.4 What the production file needs

Every name in `secretNames` in `cloudflare.config.ts` must have a value, or the deploy stops. The ones that differ from develop:

| Variable | Production value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` | The production project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The production publishable key |
| `SUPABASE_SECRET_KEY` | The production secret key |
| `SUPABASE_DIRECT_URL` | Production direct connection (port 5432), for migrations and seeding |
| `SUPABASE_DATABASE_URL` | Production transaction pooler (port 6543), for Node scripts |
| `APP_URL` | The public site URL |
| `ADMIN_EMAILS` | The production admins |

`NEXT_PUBLIC_*` values are built into the browser bundle, so the build itself must run with the production file active. `pnpm deploy:secrets` builds first, which covers this.

Decide now whether production keeps the current R2 buckets and CDN domains (`R2_BUCKET_*`, `R2_PUBLIC_DOMAIN_*`). If it does, give develop its own buckets later so test uploads stay out of production.

## Stage 1: develop

Active file: develop. Check the target (0.3).

1. Read the current state. It should show 0009 and 0010 as not applied.

   ```bash
   pnpm db:health
   ```

2. Apply the migrations.

   ```bash
   pnpm db:apply
   ```

   From this moment the live site's email-preferences request fails until step 5. Keep going.

3. Run the local gate.

   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```

   One failure in `src/components/tv/grid/TvGrid.test.tsx` is expected. It also fails on `main`.

4. Run the League chain test against develop. It creates a contest, runs it to published results, and removes what it created.

   ```bash
   RUN_DB_SMOKE=1 pnpm test src/lib/services/league/league-chain.smoke.test.ts
   ```

5. Deploy the new Worker. It still uses the develop database, and email stays off because the AWS variables are absent.

   ```bash
   pnpm deploy:secrets
   ```

6. Check the signal fix (0010). Do one League action on the live site (for example, open registration on a test contest), then read the newest rows in `event_realtime_signals` with `pnpm db:studio` or the Supabase SQL editor:

   ```sql
   select event_id, version, signal_type, created_at
   from event_realtime_signals
   order by created_at desc
   limit 5;
   ```

   The newest row should carry the specific type (`registration_changed`), not the generic `event_state_changed`.

**Go on when:** the gate passes, the chain test passes, the live site loads, `/notifications` shows the inbox with no email card (email is off), and the signal type is specific.

## Stage 2: merge

1. Push the branch and open the pull request against `main`.
2. Ignore the Vercel check; it does not build this app.
3. Merge. Later deploys run from `main`.

## Stage 3: production database

This moves the live site from the develop database to the production one.

**Read first.** Accounts and content on the develop project are **not** carried over. Sign-in is per Supabase project, so everyone signs in again and starts with a new account. Spots, TV videos and trick catalogs come back from the seed files. If you need existing users, contests or games, stop here: that is a separate data migration.

### 3.1 Sign-in on the production project

1. In the Google Cloud console, add `https://<production-ref>.supabase.co/auth/v1/callback` to the OAuth client's authorized redirect URIs.
2. In the Supabase dashboard of the production project, enable the Google provider (Authentication → Providers) with the client id and secret.
3. Under Authentication → URL Configuration, set the Site URL to the public site URL and add `https://<site>/auth/callback` to the redirect allow list.

### 3.2 Schema and reference data

Activate the production file and check the target (0.3). The host must be the production project.

1. Health check. Connectivity and PostGIS should pass; migrations should be missing.

   ```bash
   pnpm db:health
   ```

2. Apply every migration, 0000 to 0010. The baseline creates the `postgis`, `pgcrypto` and `pg_trgm` extensions and the realtime publication.

   ```bash
   pnpm db:apply
   ```

3. Seed reference data: regions, countries, taxonomy, plans, roles and the spots.

   ```bash
   pnpm db:seed
   ```

4. Seed TV videos.

   ```bash
   pnpm db:seed-tv
   ```

5. Seed trick catalogs.

   ```bash
   pnpm db:seed-tricks
   ```

6. Health check again. Everything should pass, with `0010_event_signal_trigger_deferred` as the latest migration.

   ```bash
   pnpm db:health
   ```

### 3.3 Connect the Worker

The Worker reaches Postgres only through Hyperdrive, and the config id is a constant in `cloudflare.config.ts` (`HYPERDRIVE_ID`).

1. In the Cloudflare dashboard, create a second Hyperdrive config (for example `open-spot-db-prod`) with the production project's direct connection details (host `db.<production-ref>.supabase.co`, port 5432, database `postgres`). **Turn query caching off.** Use the same connection limit as the current config (20).
2. In a small pull request, change `HYPERDRIVE_ID` to the new config's id. Keep the old id in the PR description: it is the rollback.
3. With the production file still active, deploy:

   ```bash
   pnpm deploy:secrets
   ```

4. Copy the develop file back and check the target (0.3).

### 3.4 First admin

`pnpm db:seed` grants admin only to accounts that already exist, and the production project starts with none.

1. Sign in once on the live site with the admin's Google account.
2. Activate the production file, check the target, then run this with that account's address:

   ```bash
   pnpm db:bootstrap-admin <email>
   ```

3. Copy the develop file back.

**Go on when:** sign-in works on the live site, the map shows spots, `/league` loads, you can create a contest, and `/notifications` shows the inbox with no email card.

**Rollback for this stage:** restore the old `HYPERDRIVE_ID`, activate the develop file and deploy. The site is back on develop. Nothing in the production project needs undoing.

## Stage 4: AWS and Resend

Run from the repo root with AWS credentials for the account in your shell. Full background is in [`notifications.md`](notifications.md#setup).

1. **Resend.** Create a free account (no card). Add the domain `mail.<domain>` and add the records Resend shows in Cloudflare (the zone's **DNS → Records** page), all **DNS only**: the DKIM TXT `resend._domainkey.mail`, and the MX and SPF TXT on `send.mail`. Enter the **short name** (Cloudflare appends the zone itself; pasting the full name gives `….openspotleague.com.openspotleague.com`) and save each record separately. Check with `dig +short TXT resend._domainkey.mail.<domain> @<one of the zone's name servers>`, then press Verify in Resend.
   - DMARC: keep what exists. `openspotleague.com` has `p=reject; sp=reject; adkim=s; aspf=s`; Resend signs DKIM as `mail.<domain>`, the From domain, so strict alignment passes. Never add a `p=none` record over a stricter one.
2. **API key.** In Resend, create a key with **sending access** limited to that domain. Store it as an SSM SecureString `/openspot/notifications/resend-api-key` (AWS console → Systems Manager → Parameter Store). Never paste it into chat or an env file.
3. Install the infra package, and once per account and region bootstrap CDK.

   ```bash
   pnpm aws:install
   ```

   ```bash
   pnpm --dir infra/aws exec cdk bootstrap
   ```

   Then add a lifecycle rule to the bootstrap bucket (`cdk-hnb659fds-assets-<account>-<region>`) that expires current and noncurrent objects after 1 day, so deployed bundles do not sit in S3.

4. Create the internal secret as SSM SecureString `/openspot/notifications/internal-secret`: random, 32 bytes or more. Keep it for stage 5; it is never written into the template.
5. Review, then deploy the stack. Use the same `-c` values for both commands. `appUrl` is the address the Lambdas call: the Worker's `workers.dev` address (`https://open-spot.devopenspot.workers.dev`), see below. `replyTo` is an inbox someone reads; without it, replies bounce.

   ```bash
   pnpm aws:diff -c fromAddress="OpenSpot League <no-reply@mail.<domain>>" -c appUrl=https://<worker>.workers.dev -c alertEmail=<you> -c replyTo=<inbox>
   ```

   ```bash
   pnpm aws:deploy -c fromAddress="OpenSpot League <no-reply@mail.<domain>>" -c appUrl=https://<worker>.workers.dev -c alertEmail=<you> -c replyTo=<inbox>
   ```

   Right after the first deploy, pause the tick until stage 5. Until the Worker has the internal secret, every tick gets `503 NOT_CONFIGURED`, and `osl-notify-tick-failing` fires within an hour. `update-schedule` replaces the whole schedule, so pass the target from `get-schedule` unchanged:

   ```bash
   aws scheduler update-schedule --name osl-notify-tick --state DISABLED --schedule-expression "rate(15 minutes)" --flexible-time-window Mode=OFF --target '<the current target JSON from get-schedule>'
   ```

   Cloudflare answered every non-browser request to `openspotleague.com` with a 403 on 2026-11-10, while the `workers.dev` address reached the Worker. On the Free plan this is Bot Fight Mode, and **Bot Fight Mode cannot be skipped by WAF custom rules**. So `appUrl` is the `workers.dev` address. It is used only for the Lambdas' HMAC-signed calls; links in emails come from the Worker's `APP_URL`. Keep `workers.dev` enabled for the Worker (Workers → open-spot → Settings → Domains & Routes), or the tick breaks.

6. **Webhook.** In Resend, create a webhook for `email.bounced` and `email.complained` pointing at the stack output `ResendWebhookUrl` (a Lambda Function URL, outside Cloudflare). Store its signing secret as SSM SecureString `/openspot/notifications/resend-webhook-secret`.
7. Confirm the alarm subscription email from AWS. The same address gets the zero-cost guard notice.
8. Create an access key for the IAM user `osl-worker-notify` (output `WorkerUserName`). Its only permission is sending to the queue.

**Go on when:** Resend shows the domain verified, the three SSM parameters exist, and the alarm subscription is confirmed.

## Stage 5: switch email on

1. Add these six variables to `.env.production.local`:

   | Variable | Value |
   | --- | --- |
   | `AWS_NOTIFY_ACCESS_KEY_ID`, `AWS_NOTIFY_SECRET_ACCESS_KEY` | The key from stage 4, step 8 |
   | `AWS_NOTIFY_REGION` | `us-east-1` |
   | `NOTIFY_EMAIL_QUEUE_URL` | Stack output `QueueUrl` |
   | `NOTIFICATIONS_INTERNAL_SECRET` | The same value as the SSM parameter |
   | `NOTIFICATIONS_UNSUBSCRIBE_SECRET` | Another random value. Do not change it later: old unsubscribe links stop working. |

2. Activate the production file, check the target (0.3), and deploy with the flag:

   ```bash
   OPENSPOT_NOTIFICATIONS=1 pnpm deploy:secrets
   ```

3. Copy the develop file back.
4. Turn the tick back on (paused in stage 4): the same `update-schedule` command with `--state ENABLED`.

Until the names are moved into `secretNames` (stage 7), **every** production deploy needs `OPENSPOT_NOTIFICATIONS=1`. A deploy without it leaves the six variables undeclared, and email goes off.

Rows created before this deploy were never marked for email, so nothing old is sent.

## Stage 6: verify

1. **Cloudflare lets AWS in.** Invoke the tick once and read the result.

   ```bash
   aws lambda invoke --function-name osl-notify-tick out.json
   ```

   `out.json` should hold the tick counts. A 403 or an HTML page means Bot Fight Mode blocked the request: turn it off for the zone, or redeploy the stack with the Worker's `workers.dev` address as `appUrl`. A 401 means the internal secret differs between SSM and the Worker.

2. **Preferences card.** `/notifications` now shows the email card with the four categories and "Sent to <your address>".
3. **A real email.** With two accounts, create a contest, open registration and join with the second account. The organizer gets "registration confirmed" within about 15 minutes (it is a digest). Cancelling a test contest sends an immediate email to its members.
4. **Unsubscribe.** Open the footer link in that email. The page names the category. Confirm, then check that the toggle is off in `/notifications`.
5. **Delivery state.** In the SQL editor, the rows should end as `sent`:

   ```sql
   select type, email_status, email_urgency, created_at
   from user_notifications
   order by created_at desc
   limit 10;
   ```

6. **Bounce path (optional).** Send one queue job to Resend's test address `bounced@resend.dev`. The webhook delivery shows in Resend, the log group `/aws/lambda/osl-notify-resend-events` shows a verified event, and the address appears in `user_email_preferences.suppressed_at` (only if a profile has that address).
7. **Email budget.** `select * from notification_email_budget order by day desc limit 3` shows today's count.
8. **Alarms.** `osl-notify-tick-failing` and `osl-notify-email-dlq-not-empty` are in the OK state.

## Stage 7: after

- **Make email permanent.** Move the six names from `notificationSecretNames` into `secretNames` in `cloudflare.config.ts` and drop the flag, so a plain deploy cannot switch email off. The develop file then needs the six variables too; leave develop pointing at no queue only if you accept that deploys must come from the production file.
- **Develop cleanup.** In the develop project, delete the unused Vault secrets `resend_api_key` and `email_from`. They belonged to the old sweep. The production project never had them.
- **Rotation.** Rotate the `osl-worker-notify` access key every 90 days, and at once if an env file may have leaked. Rotate the internal secret in SSM and on the Worker together. Rotate the Resend key in SSM, then revoke the old one in Resend.
- **AWS account plan (deadline 2027-03-22).** The account is on the AWS Free plan, which ends on 2027-03-22. On that date AWS suspends the account, so email, the tick and the alarms stop, and deletes it 90 days later. Before then, open Billing and Cost Management → **Upgrade to Paid plan**. The remaining credits carry over automatically. On the Paid plan the always-free limits still apply, and the stack's zero-cost guard stops everything if a real charge ever appears. Full costs are in [`notifications.md`](notifications.md#cost).
- **Budgets.** `osl-notify-zero-cost` (credits excluded) stops the stack at any actual charge above $0.01; `osl-notify-monthly` ($1, alert at 50%) is the early warning. Resend's free plan cannot bill (no card); the app caps email at 95 a day and 2,900 a month.
- **Runbook.** Alarm handling is in [`notifications.md`](notifications.md#runbook).

## Stopping and rolling back

| Need | Do |
| --- | --- |
| Stop all email now | Deploy production without `OPENSPOT_NOTIFICATIONS=1`, or disable the `osl-notify-tick` schedule and the queue's Lambda trigger in AWS. In-app notifications keep working. |
| Undo the AWS stack | `pnpm --dir infra/aws exec cdk destroy`, then remove the Resend domain records from DNS. |
| Go back to the develop database | Restore the old `HYPERDRIVE_ID` and deploy with the develop file. |
| Undo 0009 | Not possible. The old email sweep is gone. The new code does not need it. |
| Undo 0010 | Not needed. It only changes when the signal trigger fires. |

## Recommended follow-up

Copying env files by hand is the weak point of this guide. A small change would remove it: let `src/db/load-env.ts` and `scripts/deploy-with-secrets.ts` read the file named in `OPENSPOT_ENV_FILE`, and make `src/db/apply-sql.ts` print the target host and ask for confirmation when it is not the develop project.
