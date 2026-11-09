# Repository Guide

OpenSpot is an interactive map of action sports spots (skateboard, BMX, scooter, roller), with user-created and curated contests (the League, `/league`), multiplayer trick-challenge games, and action sports TV.

It is one private Next.js 16 App Router app (React 19, Cache Components) that runs on vinext (Vite) and deploys to Cloudflare Workers. Data lives in Supabase (Postgres + PostGIS, Auth, Realtime), reached through Drizzle and Hyperdrive. Media lives on Cloudflare R2. It uses Node 22 (`.nvmrc`) and pnpm 12.16.1 (`packageManager` in `package.json`). It is not a monorepo: `pnpm-workspace.yaml` only holds pnpm policies.

This file keeps the commands, the map, and the hard rules. Detailed explanations live in `docs/`.

## Commands

**CI is not set up yet (pending task).** Until it exists, the local gate is the only verification:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

The Vercel GitHub check that runs on pull requests is a leftover integration. It does not build this app (the app deploys to Cloudflare Workers) and it is not a gate, so ignore its result until the CI work replaces or removes it.

- `pnpm lint`: `eslint src` (flat config).
- `pnpm typecheck`: `tsc --noEmit`, strict, with `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters`.
- `pnpm test`: `vitest run` in `happy-dom` with globals. It only picks up `src/**/*.{test,spec}.{ts,tsx}`, aliases `@` to `src`, and stubs `server-only`.
  - Single file: `pnpm test src/path/file.test.ts`. By name: add `-t "name"`. Watch mode: `pnpm test:watch`.
- `pnpm build`: `vite build`. It must stay DB-free.
- `pnpm dev`: `vite dev --port 3000`. `pnpm start`: `vite preview`, which runs the production build in `workerd`.
  - Both reach Postgres only through `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. Without a working connection, pages return 200 with empty fallbacks, so a 200 does not prove a data path works.
  - Never point `.env.local` at the production pooler (see `docs/caching-and-egress.md`).
- `pnpm deploy`: deploy to Cloudflare. `pnpm deploy:response-store`: deploy the cache Worker.
- `pnpm deploy:secrets`: deploy and upload the declared secrets from `.env.local`. It is needed for the first deploy and whenever a value changes. Never pass `.env.local` to `cf deploy --secrets-file`: it uploads every key in the file, including `CLOUDFLARE_API_TOKEN` and the pooler URLs.
- Database: `pnpm db:apply` (migrations), `pnpm db:fresh:seed` (reset, migrate, and seed everything), `pnpm db:health`, `pnpm db:check-pool`, `pnpm egress:snapshot`. Full list in `docs/database.md`.
  - These scripts load `.env.local` with `override: true`, so a connection URL exported in the shell is ignored. Check `.env.local` before running anything destructive.

## Map

| Path | Role |
| --- | --- |
| `src/proxy.ts` | Next 16 proxy (replaces `middleware.ts`). Handles request ids, per-IP rate limits, the seed cookie, Supabase session refresh, and security headers. |
| `src/worker.ts` | Workers entry. Opens the request scope around vinext's handler. |
| `cloudflare.config.ts` | Worker config. A server env var must be declared here or the Worker never sees it, and every declared name must have a value at deploy time. |
| `src/lib/config/env.ts` | Env schema and defaults. Import config from here. |
| `src/app/**` | Pages and route handlers. They only call services. |
| `src/lib/services/*` | Orchestration and the single writers. |
| `src/lib/repositories/*` | Repository interfaces plus Drizzle implementations, resolved through `repositories/index.ts`. |
| `src/lib/games/*`, `src/lib/league/*` | Pure domain engines (state machines, scoring, capabilities). No DB or IO, except `src/lib/league/realtime.ts` (Supabase browser channel); unit-tested. |
| `src/lib/league/rating/*` | League rating engine from Article 9 (Res. 082/2026): Park/Street/Vert formats, the five criteria, required elements per discipline, 0–10 scoring, trimmed-mean panel, division ranking. |
| `src/lib/db/client.ts` | `withDbRead`, `withDbWrite`, `withDbRetry`, pool configuration, global concurrency gate. |
| `src/lib/cache/` | `lifetimes.ts` (cache profiles), `deferred.ts` (post-commit invalidation). |
| `src/db/schema.ts` | Schema source of truth: re-exports `src/db/schema/index.ts`, which holds every table (League tables included). `auth`, `spots`, `games` and `taxonomy` are per-domain barrels over it. Migrations live in `supabase/migrations/`. |
| `src/data/` | JSON seed fixtures (spots, TV, tricks, taxonomy, RBAC). |
| `DESIGN.md` | Design tokens and UI system. |

## Hard rules

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

- `docs/architecture.md`: request lifecycle, layers, repositories, write path, deletion lifecycle, error mapping, security headers.
- `docs/caching-and-egress.md`: Cache Components, invalidation, the Supabase egress budget, RSC payloads, polling.
- `docs/cloudflare-security.md`: Workers request quota, dashboard bot settings, WAF custom and rate-limit rules, Workers Paid limits, incident checklist.
- `docs/database.md`: environment, migrations, seeding, RBAC/RLS, realtime, storage.
- `docs/league.md`: League contests — routes, the contest hub, divisions and video contests, the Article 9 rating, leaderboards, public listing rule, plans and payment gate, covers, contest curation, write path, errors.
- `docs/og-cards.md`: share (Open Graph) images — generated vs static, the `design/og-cards/` card sheet, export, shipping a card, scaling to generated images.
- `docs/ui-conventions.md`: UI rules and component organization.
