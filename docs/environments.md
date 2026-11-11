# Environments

OpenSpot runs in two deployed environments, **develop** and **production**, plus local development. They share the code and differ only in configuration. The delivery flow between them is in [`ci-cd.md`](ci-cd.md).

## The matrix

| | Local | Develop | Production |
| --- | --- | --- | --- |
| Purpose | Your machine | Integration: every merge to `main`, seen by the team | Real users |
| Build mode (`--mode`) | `development` | `develop` | `production` |
| `APP_ENV` | `local` | `develop` | `production` |
| `NODE_ENV` | `development` | `production` | `production` |
| URL | `http://localhost:3000` | `https://dev.openspotleague.com` | `https://openspotleague.com` |
| Worker | `vite dev` | `open-spot-develop` | `open-spot` |
| `workers.dev` address | — | `open-spot-develop.devopenspot.workers.dev` (smoke tests) | `open-spot.devopenspot.workers.dev` (smoke tests and the AWS Lambdas) |
| Supabase project | develop (`vvmfgkphetdfyhnrrwar`) | develop (`vvmfgkphetdfyhnrrwar`) | production (`pvnchrcczjnoubymrvzz`) |
| Hyperdrive | local connection string | `open-spot-db` | `open-spot-db-prod` |
| R2 uploads | develop buckets | `openspotleague-dev-spots`, `openspotleague-dev-events` | `openspotleague-spots`, `openspotleague-events` |
| CDN for uploads | develop CDN | `spots-dev.cdn.openspotleague.com`, `events-dev.cdn.openspotleague.com` | `spots.cdn.openspotleague.com`, `events.cdn.openspotleague.com` |
| Response-store Worker | — | `open-spot-develop-response-store` | `open-spot-response-store` |
| Email | off | off (in-app notifications only) | on (AWS `OpenSpotNotifications` + Resend) |
| Search engines | — | blocked (`noindex`, robots disallow) | indexed |
| Deployed by | — | `deploy-develop.yml`, on push to `main` | `release-production.yml`, manual + approval |

Why these choices:

- **Same `NODE_ENV` on both deployed environments.** Develop must behave like production (secure cookies, HSTS, pool sizes). Code that needs to know which environment it is in reads `APP_ENV`, never `NODE_ENV` and never the hostname.
- **Production keeps the `open-spot` Worker** because it already owns the apex domain and the `workers.dev` address the AWS Lambdas call. Develop is a new Worker, so the cut-over moves no DNS.
- **Develop has its own R2 buckets** so test uploads never land in production. Seed data keeps production CDN URLs for spot images, which develop only reads.
- **Develop sends no email.** Resend's free plan allows 100 emails a day per account; develop would spend production's budget. Notifications still appear in the in-app inbox.
- **Local development uses the develop database.** There is no third database to keep in sync. Destructive scripts refuse production (see [Guards](#guards)).

## Where configuration lives

| Kind | Where | Examples |
| --- | --- | --- |
| Per-environment, not secret | Committed files `.env.develop`, `.env.production` | `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, bucket names, CDN domains, pool sizes |
| Per-environment Worker shape | `cloudflare.config.ts`, the `ENVIRONMENTS` map | Worker name, Hyperdrive id, custom domain, response-store names |
| Secrets for the Worker | GitHub environment secrets (`develop`, `production`) | `SUPABASE_SECRET_KEY`, `R2_SECRET_ACCESS_KEY`, `API_KEY_WEATHER` |
| Secrets for the pipeline only | GitHub environment secrets | `CLOUDFLARE_API_TOKEN`, `SUPABASE_MIGRATION_URL` |
| Local development | `.env.local` (git-ignored) | Everything, pointing at develop |
| Break-glass laptop deploys | `.env.develop.local`, `.env.production.local` (git-ignored) | The secrets of that environment |
| Defaults | `src/lib/config/env.ts` | Everything optional |

Rules:

- **Never put a secret in `.env.develop` or `.env.production`.** The repository is public. A unit test fails if a name declared as a Worker secret appears in either file.
- **Public values are baked into the browser bundle at build time** (`NEXT_PUBLIC_*`). The build must therefore run for one environment: `pnpm build:develop` or `pnpm build:production`. These wrappers load the committed file into the process environment first, because vinext otherwise lets `.env.local` (develop values) win over `.env.production`.
- **A server variable must be declared in `cloudflare.config.ts`** or the Worker never sees it. Non-secret ones are `bindings.text(...)` with the value from the committed file; secrets are `bindings.secret()` and must have a value at deploy time.
- To add a variable: add it to `src/lib/config/env.ts`, then either to both committed files (not secret) or to the secret list in `cloudflare.config.ts` and to both GitHub environments (secret).

## Secrets inventory

GitHub → Settings → Environments → `develop` / `production` → Environment secrets. Both environments use the same names with their own values.

| Secret | Develop | Production | Used by |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | yes | yes | Deploy (one token per environment, so each can be revoked alone) |
| `SUPABASE_MIGRATION_URL` | yes | yes | `db:apply`, seeds, `db:health` in workflows. **Session pooler**, port 5432 |
| `SUPABASE_SECRET_KEY` | yes | yes | Worker, seeds |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | yes | yes | Worker uploads |
| `API_KEY_WEATHER` | yes | yes | Worker |
| `ADMIN_EMAILS` | yes | yes | Worker, `db:seed` |
| `AWS_NOTIFY_ACCESS_KEY_ID`, `AWS_NOTIFY_SECRET_ACCESS_KEY`, `AWS_NOTIFY_REGION`, `NOTIFICATIONS_INTERNAL_SECRET`, `NOTIFICATIONS_UNSUBSCRIBE_SECRET`, `NOTIFY_EMAIL_QUEUE_URL` | — | yes | Worker email delivery |
| `AWS_DEPLOY_ROLE_ARN` | — | yes | `infra-aws.yml` (GitHub OIDC; no AWS keys stored) |

Variables (not secret): repository variable `CLOUDFLARE_ACCOUNT_ID`; `production` environment variable `EMAIL_ENABLED` (`true` once the AWS stack serves production; until then the release deploys without the email secrets).

Why the session pooler for migrations: GitHub-hosted runners have no IPv6, and Supabase's direct host (`db.<ref>.supabase.co`) is IPv6-only without the paid IPv4 add-on. The session pooler (`aws-<n>-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`) speaks IPv4 and keeps session state, so the advisory lock in `src/db/apply-sql.ts` still works. Never use the transaction pooler (port 6543) for migrations.

Cloudflare API token permissions (Account → API Tokens → Create custom token): Account · Workers Scripts · Edit; Account · Workers R2 Storage · Edit (response-store bucket); Account · Hyperdrive · Read; Zone `openspotleague.com` · Workers Routes · Edit; Zone · DNS · Edit (custom domain records). Restrict it to the one account and zone.

## Guards

Every database script prints its target before doing anything, for example `db target: develop (aws-1-us-west-2.pooler.supabase.com:5432, ref vvmfgkphetdfyhnrrwar)`. The target is detected from the project ref in the connection URL (`src/db/target.ts`); refs are public, so they are written in the code.

| Script | Develop | Production |
| --- | --- | --- |
| `db:reset`, `db:fresh`, `db:fresh:seed` | allowed | **refused** |
| `storage-gc --delete` | allowed | **refused** |
| `db:apply`, `db:seed*`, `db:bootstrap-admin` | allowed | only in CI, or with `OPENSPOT_CONFIRM_PRODUCTION=1` |
| `db:health`, `db:check-pool`, `egress:snapshot` | allowed | allowed |

`OPENSPOT_ENV=develop|production` picks the env file a script loads (`.env.develop.local` / `.env.production.local`); without it, scripts load `.env.local` as before. If `OPENSPOT_ENV` says one environment and the URL points at the other, the script stops.

## One-time setup

Do these once, in order. Steps 1–4 are needed before the develop workflow can run; step 5 before the first production release.

### 1. Supabase

1. **Production password.** Reset the production database password (Project Settings → Database). The old one was shared in a chat on 2026-11-10.
2. **Session pooler URLs.** For each project, copy the session pooler connection string (Connect → Session pooler) into the GitHub secret `SUPABASE_MIGRATION_URL` of the matching environment.
3. **Auth on production.** Enable the Google provider; set Site URL to `https://openspotleague.com`; add `https://openspotleague.com/auth/callback` to the redirect allow list.
4. **Auth on develop.** Set Site URL to `https://dev.openspotleague.com`; allow `https://dev.openspotleague.com/auth/callback` and `http://localhost:3000/auth/callback`.
5. **Google OAuth client.** Authorized redirect URIs: `https://vvmfgkphetdfyhnrrwar.supabase.co/auth/v1/callback` and `https://pvnchrcczjnoubymrvzz.supabase.co/auth/v1/callback`.
6. **Plan.** The production project should be on Supabase Pro before real users arrive: daily backups and no pausing. Develop can stay on Free; the daily deploys keep it awake.

### 2. Cloudflare

1. **Hyperdrive for production.** Create `open-spot-db-prod` with the production direct connection (host `db.pvnchrcczjnoubymrvzz.supabase.co`, port 5432, database `postgres`), **query caching off**, connection limit 20. Put its id in `cloudflare.config.ts` (`ENVIRONMENTS.production.hyperdriveId`).
2. **Develop R2.** Create buckets `openspotleague-dev-spots` and `openspotleague-dev-events`, attach the custom domains `spots-dev.cdn.openspotleague.com` and `events-dev.cdn.openspotleague.com`, and copy the CORS policy from the production buckets. Create an R2 API token scoped to the two develop buckets for the develop `R2_*` secrets.
3. **API tokens.** Create one token per environment with the permissions above.
4. **Workers Paid ($5/month) is recommended.** The Free plan's 100,000 requests a day is per account, so develop traffic and CI smoke tests count against production's quota.
5. The develop custom domain `dev.openspotleague.com` is attached by the first develop deploy (it is declared in `cloudflare.config.ts`). Bot Fight Mode and the WAF rules in [`cloudflare-security.md`](cloudflare-security.md) apply to it too; that is expected.

### 3. GitHub

1. **Environments.** Settings → Environments → create `develop` and `production`.
   - `develop`: deployment branch `main` only.
   - `production`: deployment branches `main` and `hotfix/*`; **required reviewers** (at least one maintainer; with two or more maintainers, tick "prevent self-review"); wait timer 0.
   - Add the secrets from the inventory to each.
2. **Ruleset on `main`** (Settings → Rules → Rulesets → New branch ruleset), as listed in [`ci-cd.md`](ci-cd.md#rules-on-main-github-ruleset). Required check: `ci-ok`. Do not tick "require review from Code Owners": CODEOWNERS only requests reviewers.
3. **Merge settings** (Settings → General): allow squash merging only; default commit message "pull request title"; automatically delete head branches.
4. **Actions** (Settings → Actions → General): "Require approval for all outside collaborators" for fork pull requests; workflow permissions "read repository contents".
5. **Remove the Vercel integration** (Settings → GitHub Apps / Integrations). It does not build this app.

### 4. First develop deploy

Merge the pull request that adds `deploy-develop.yml`. The run creates the `open-spot-develop` Worker, its response-store Worker and bucket, and the `dev.openspotleague.com` record. Check it in [`ci-cd.md`](ci-cd.md#5-deploy-to-develop-automatic) terms: smoke job green, site loads, sign-in works.

### 5. First production release (the cut-over)

Today the `open-spot` Worker still uses the develop database. The first release moves it to production:

Before it: `ENVIRONMENTS.production.hyperdriveId` in `cloudflare.config.ts` and the production publishable key in `.env.production` are filled in (a production build refuses `__SET_ME__` and an empty id), merged through a normal pull request.

1. Run **db-task** → `production` → `health` (connectivity and PostGIS pass, migrations missing).
2. Run **release-production** on `main`. It applies every migration to the empty production database and deploys `open-spot` with the production Hyperdrive and values.
3. Run **db-task** → `production` → `seed`, then `seed-tv`, then `seed-tricks`.
4. Sign in once on `https://openspotleague.com` with each admin account, then run **db-task** → `production` → `bootstrap-admins`.

Accounts and content created on develop are not carried over: sign-in is per Supabase project. This supersedes stage 3 of [`notifications-deploy.md`](notifications-deploy.md).

### 6. AWS (email, production only)

1. Create an IAM OIDC identity provider for `token.actions.githubusercontent.com` (audience `sts.amazonaws.com`).
2. Create the role `osl-github-deploy`, trusted only for `repo:devopenspot/openspotleague:environment:production`, with the permissions CDK needs (`sts:AssumeRole` on the `cdk-hnb659fds-*` bootstrap roles is enough). Put its ARN in the `production` secret `AWS_DEPLOY_ROLE_ARN`.
3. Delete the root user's access key that ran the first CDK deploy.

## Break-glass deploys from a laptop

Only when GitHub Actions is down. Fill `.env.develop.local` or `.env.production.local` with that environment's secrets (same names as the inventory), then:

```bash
pnpm build:develop && pnpm deploy:develop
```

```bash
pnpm build:production && pnpm deploy:production
```

The deploy script refuses a build made for the other environment. Afterwards, re-run the workflow for the same commit so the environment's record matches what is live.

## Cost notes

| Service | Develop | Production |
| --- | --- | --- |
| Cloudflare Workers | shared account quota | shared account quota; Paid recommended |
| Supabase | Free | Pro recommended (backups) |
| R2 | Free tier (10 GB) shared | Free tier shared |
| AWS + Resend | none | $0 by design (zero-cost guard, daily cap) |
| GitHub Actions | free for public repositories | free |
