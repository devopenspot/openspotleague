# Repository Guide

OpenSpot is an interactive map of action sports spots (skateboard, BMX, scooter, roller), with user-created and curated contests (the League, `/league`), multiplayer trick-challenge games, and action sports TV.

It is one private Next.js 16 App Router app (React 19, Cache Components) that runs on vinext (Vite) and deploys to Cloudflare Workers. Data lives in Supabase (Postgres + PostGIS, Auth, Realtime), reached through Drizzle and Hyperdrive. Media lives on Cloudflare R2. It uses Node 22 (`.nvmrc`) and pnpm 12.16.1 (`packageManager` in `package.json`). It is not a monorepo: `pnpm-workspace.yaml` only holds pnpm policies.

This file keeps the commands, the map, and the hard rules. Detailed explanations live in `docs/`.

## Commands

The local gate, the same one CI runs on every pull request (`.github/workflows/ci.yml`, required check `ci-ok`):

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Delivery is trunk-based: short branch → pull request (Conventional Commit title, green CI, one approval) → squash merge to `main` → automatic deploy to **develop** → manual, approved release to **production**. See `docs/ci-cd.md` and `docs/environments.md`. The Vercel GitHub check on pull requests is a leftover integration that does not build this app; ignore it until it is removed.

- `pnpm lint`: `eslint src` (flat config).
- `pnpm typecheck`: `tsc --noEmit`, strict, with `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters`.
- `pnpm test`: `vitest run` in `happy-dom` with globals. It only picks up `src/**/*.{test,spec}.{ts,tsx}`, aliases `@` to `src`, and stubs `server-only`.
  - Single file: `pnpm test src/path/file.test.ts`. By name: add `-t "name"`. Watch mode: `pnpm test:watch`.
- `pnpm build:develop` / `pnpm build:production` (`scripts/build.ts`): `vite build --mode <env>` with the committed `.env.<env>` pinned, because `NEXT_PUBLIC_*` values are baked in. `pnpm build` is `build:develop`. Builds must stay DB-free.
- `pnpm dev`: `vite dev --port 3000`. `pnpm start`: `vite preview`, which runs the production build in `workerd`.
  - Both reach Postgres only through `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. Without a working connection, pages return 200 with empty fallbacks, so a 200 does not prove a data path works.
  - Never point `.env.local` at the production pooler (see `docs/caching-and-egress.md`).
- `pnpm deploy:develop` / `pnpm deploy:production` (`scripts/deploy.ts`): deploy the matching build (response-store Worker, then the app) with only the declared secrets, read from the process environment or `.env.<env>.local`, never `.env.local`. The workflows run these; from a laptop they are break-glass only. Never pass an env file to `cf deploy --secrets-file` directly.
- `pnpm db:check-migrations <base-sha>`: the CI migration rule (only new, sequentially numbered files).
- Database: `pnpm db:apply` (migrations), `pnpm db:fresh:seed` (reset, migrate, and seed everything), `pnpm db:health`, `pnpm db:check-pool`, `pnpm egress:snapshot`. Full list in `docs/database.md`.
  - These scripts load `.env.local` with `override: true`, so a connection URL exported in the shell is ignored. Check `.env.local` before running anything destructive.

## Map

| Path | Role |
| --- | --- |
| `src/proxy.ts` | Next 16 proxy (replaces `middleware.ts`). Handles request ids, per-IP rate limits, the seed cookie, Supabase session refresh, and security headers. |
| `src/worker.ts` | Workers entry. Opens the request scope around vinext's handler. |
| `cloudflare.config.ts` | Worker config per environment (`ENVIRONMENTS`: Worker name, Hyperdrive id, domains). A server env var must be declared here (`SECRET_NAMES` or `RUNTIME_VARIABLE_NAMES`) or the Worker never sees it, and every declared secret must have a value at deploy time. |
| `.env.develop`, `.env.production` | Committed, non-secret values per environment; they become Worker text variables and the baked `NEXT_PUBLIC_*` values. |
| `src/db/target.ts` | Detects which Supabase project a CLI script targets and refuses destructive work on production. |
| `src/lib/config/env.ts` | Env schema and defaults. Import config from here. |
| `src/app/**` | Pages and route handlers. They only call services. |
| `src/lib/services/*` | Orchestration and the single writers. |
| `src/lib/repositories/*` | Repository interfaces plus Drizzle implementations, resolved through `repositories/index.ts`. |
| `src/lib/games/*`, `src/lib/league/*` | Pure domain engines (state machines, scoring, capabilities). No DB or IO, except `src/lib/league/realtime.ts` (Supabase browser channel); unit-tested. |
| `src/lib/league/rating/*` | League rating engine from Article 9 (Res. 082/2026): Park/Street/Vert formats, the five criteria, required elements per discipline, 0–10 scoring, trimmed-mean panel, division ranking. |
| `src/lib/notifications/*` | Notification writer, `EMAIL_POLICY`, reminders, and email delivery (`delivery/`: outbox dispatcher, SQS producer, signed Lambda contract). |
| `infra/aws/` | Separate CDK package: SQS FIFO, three Lambdas (sender via Resend, tick, Resend webhook), the 15-minute Scheduler tick, the zero-cost guard. See `docs/notifications.md`. |
| `src/lib/db/client.ts` | `withDbRead`, `withDbWrite`, `withDbRetry`, pool configuration, global concurrency gate. |
| `src/lib/cache/` | `lifetimes.ts` (cache profiles), `deferred.ts` (post-commit invalidation). |
| `src/db/schema.ts` | Schema source of truth: re-exports `src/db/schema/index.ts`, which holds every table (League tables included). `auth`, `spots`, `games` and `taxonomy` are per-domain barrels over it. Migrations live in `supabase/migrations/`. |
| `src/data/` | JSON seed fixtures (spots, TV, tricks, taxonomy, RBAC). |
| `DESIGN.md` | Design tokens and UI system. |

## Hard rules

### Delivery (`docs/ci-cd.md`, `docs/environments.md`, `docs/feature-flags.md`)

- `main` is the only long-lived branch. Never create `develop`, `staging` or release branches; "develop" is an environment fed by `main`.
- Deploys and migrations on develop and production run from the workflows, not from a laptop (break-glass only, `docs/environments.md`).
- Every migration must work with the code that is live when it is applied: migrations run before the deploy and are never rolled back. Breaking changes use expand/contract over separate releases.
- Code that depends on the environment reads `APP_ENV` (`local`, `develop`, `production`), never `NODE_ENV` or the hostname.
- Feature flags are only for big features (several pull requests, staged rollout, kill switch). Each has an owner and a `removeBy` date. Plans and capabilities in `src/lib/league` are entitlements, not flags.
- Never commit a secret: the repository is public. Non-secret per-environment values go in `.env.develop` / `.env.production`; secrets go in the GitHub environments.

### Architecture (`docs/architecture.md`)

- Pages and route handlers never import Drizzle or `@/db/schema`. The flow is always page/route → service → repository.
- Get repositories from `@/lib/repositories` (proxies or `get<Entity>RepositoryAsync()`), never by constructing a Drizzle implementation.
- Game and league mutations go through their services: `withDbWrite` + `db.transaction` + `expectedVersion` OCC + an idempotent `requestFingerprint` + a realtime signal row. Contest curators reuse the league writers with `{ asCurator: true }`; never add parallel curator writers.
- Build every contest URL with `src/lib/league/urls.ts` (`/league/**`). Free-plan contests stay unlisted (QR/invite only); public listing needs a paid or comped non-free plan (`canListPublicly`).
- League scores come from the rating engine (`src/lib/league/rating/`). Before results are published, members see panel totals only: project per-judge scores with `src/lib/league/visibility.ts`, never send raw score rows to riders.
- Any new `RESTRICT` foreign key to `spots` must be handled in `detachSpotDependents`.
- Import canonical paths. About 65 files in `src/lib`, `src/lib/services`, and `src/lib/repositories` are `@deprecated` one-line re-export shims, for example `@/lib/safe-fetch` → `@/lib/utils/safe-fetch`; `@/lib/supabase/storage` → `@/lib/storage` is one more.
- Storage errors are `UploadValidationError`. Check them with `instanceof`, never by matching the message.
- Security headers are defined in two places that must stay in sync: `next.config.mjs` `headers()` and `src/lib/security/headers.ts`.

### Workers runtime (`docs/architecture.md`)

- Sockets and in-flight promises cannot cross requests. Module-level state holding either must go through `perRequest` (`src/lib/utils/request-scope.ts`). Plain data caches are fine.
- The Worker reaches Postgres only through the `HYPERDRIVE` binding, because `workerd` rejects the Supabase pooler's private CA. Never give the Worker a pooler URL, and keep Hyperdrive query caching disabled.
- `public/` is not on disk at runtime.
- Native modules do not load. `sharp` is bundled but throws on import in `workerd`, so image uploads store the original file with no WebP variants and raise no error.
- `clientIp` must keep `cf-connecting-ip` first. On Workers the other forwarding headers are client-controlled.

### Caching and data (`docs/caching-and-egress.md`)

- Never call `revalidateTag` inside a transaction. Use `queueTagRevalidate` and extend the existing `revalidate*Caches` / `revalidate*Paths` helpers.
- `revalidateTag(tag, profile)` must be passed the exact profile object from `src/lib/cache/lifetimes.ts`, never an inline literal.
- Public reads that fan out to many visitors use `"use cache: remote"` and stay under 2 MB per entry. User-specific reads use `"use cache"` or `"use cache: private"`.
- Reads use `withDbRead` and are never wrapped in `db.transaction`.
- Permission checks on read paths use `getAuthorizationSnapshotCached(userId)`.
- Pass minimal UI projections to Client Components, never raw DB rows.
- Child layouts never refetch data or remount providers that `RootLayout` already provides.
- High-cadence polling endpoints do a single-query version pre-check and return `304` with an empty body. Client poll rates must stay below the proxy tier limit.
- The build stays DB-free: layouts call `connection()` and wrap reads in `withSafeDefault` / `withSafeDefaultResult` with the `EMPTY_*` fallbacks.
- **Never query Supabase logs** from agents or scripts (no MCP `get_logs`, no Management API log endpoints). Use `pg_stat_statements` or `pnpm egress:snapshot` instead.
- Before finishing a change that touches DB reads or writes, caching, layouts, API routes, polling or realtime, migrations, auth, storage, scripts, or MCP/agent config, run `/supabase_egress_bestpractices` (`.claude/commands/supabase_egress_bestpractices.md`) on the diff and resolve any blockers.

### Notifications (`docs/notifications.md`)

- Create notifications only through `createNotifications(tx, …)` inside the write transaction. Email goes out after commit; never call SQS or the email provider from inside a transaction.
- Email must stay free: it goes through Resend's free plan only, every send passes the daily budget (`deliveryStore.reserveEmailBudget`), and AWS resources stay inside the always-free tier (the `osl-notify-zero-cost` guard stops the stack on any charge).
- `src/lib/notifications/delivery/contract.ts` and `sender-batch.ts` are imported by the Lambdas by relative path: no `@/` imports there.
- AWS never connects to Postgres. Lambdas reach the app only through the signed `/api/internal/notifications/*` routes.

### Database (`docs/database.md`)

- Applied migrations are immutable; fixes ship as new files. Write new migrations by hand as the next numbered SQL file: there are no drizzle snapshots, so `drizzle-kit generate` would emit the whole schema.
- Never expose `SUPABASE_SECRET_KEY`. Only `getAdminClient()` (`src/lib/auth/auth.ts`) and `src/lib/supabase/admin.ts` may read it.

### UI (`docs/ui-conventions.md`, `DESIGN.md`)

- No `animate-pulse` outside skeleton and loading components.
- Form controls are at least 16px on mobile (`text-base sm:text-sm`). Never set `maximum-scale` or `user-scalable=no`.
- The dark map palette applies only to the map canvas and on-map overlays.
- Shape rule: controls (buttons, inputs, selects, pills, chips, tabs, tags, icon buttons) are `rounded-control` (full) and `h-control` (44px), and buttons match inputs (same height, 1px border). Containers (cards, panels, fieldsets, textareas, empty states) are `rounded-container` (16px); nested rows are `rounded-inner` (14px); small tiles are `rounded-card` (12px). The only 4px shapes are map pins, map event markers and the locked TV card corner tab (`DESIGN.md` `shape.usage`). No new `rounded-[*]` literals.
  - Locked exception: the `TvMarqueeCard` corner tab (flush top-left, `rounded-tl-sm rounded-br-sm`) is an owner decision. Never restyle it into a pill or `tagClass`. The spec is in `DESIGN.md` `components.tv-card`.
- Build UI from the class recipes in `src/components/ui/recipes.ts` (`controlClass`, `chipClass`, `tagClass`, `INPUT`, `EYEBROW`, `PAGE_TITLE`, `CARD`, `pageContainer`, …). `cn` does not merge Tailwind classes: pick a variant, never override a recipe's radius, height or colour from the call site, and never restyle a shared component with `!important` classes.
- Pages share one gutter: `px-5 md:px-10` (`pageContainer`).
- One wash per route: warm `bg-gradient-primary` for the Home hero and the Games landing page, lime `bg-gradient-profile` for Profile, cyan `bg-gradient-support` for Support, electric-blue `bg-gradient-league` (`LeagueWash`) for the League landing, contest page, result card and join page. Everything else is monochrome surface, including the League create form, the ranking and the contest hub panel that sits on the contest page (TV is the navy wire).
- The nav is a "pill track" on the black chrome: the active item is an inverted `bg-on-wire text-wire` pill on desktop, the bottom bar and the drawer alike. NavLink variants own those styles.
- Keep Next image optimization off (`unoptimized: true`); images come straight from the R2 CDN.

## Docs

- `docs/ci-cd.md`: trunk-based flow, pull requests, the develop and production pipelines, releases, rollback, hotfix, migration policy.
- `docs/environments.md`: the develop/production matrix, where configuration and secrets live, guards, one-time setup.
- `docs/feature-flags.md`: when to use a flag, how flags are evaluated and toggled, lifecycle.
- `docs/architecture.md`: request lifecycle, layers, repositories, write path, deletion lifecycle, error mapping, security headers.
- `docs/caching-and-egress.md`: Cache Components, invalidation, the Supabase egress budget, RSC payloads, polling.
- `docs/cloudflare-security.md`: Workers request quota, dashboard bot settings, WAF custom and rate-limit rules, Workers Paid limits, incident checklist.
- `docs/database.md`: environment, migrations, seeding, RBAC/RLS, realtime, storage.
- `docs/notifications.md`: in-app and email notifications, the email policy, the outbox, AWS setup and runbook.
- `docs/league.md`: League contests — routes, the contest hub, divisions and video contests, the Article 9 rating, leaderboards, public listing rule, plans and payment gate, covers, contest curation, write path, errors.
- `docs/og-cards.md`: share (Open Graph) images — generated vs static, the `design/og-cards/` card sheet, export, shipping a card, scaling to generated images.
- `docs/ui-conventions.md`: UI rules and component organization.
