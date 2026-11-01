# Repository Guide

OpenSpot is an interactive map of action sports spots (skateboard, BMX, scooter, roller), with community and editorial events (the "league"), multiplayer trick-challenge games, and action sports TV.

It is one private Next.js 16 App Router app (React 19, Cache Components) that runs on vinext (Vite) and deploys to Cloudflare Workers. Data lives in Supabase (Postgres + PostGIS, Auth, Realtime), reached through Drizzle and Hyperdrive. Media lives on Cloudflare R2. It uses Node 22 (`.nvmrc`) and pnpm 12.16.1 (`packageManager` in `package.json`). It is not a monorepo: `pnpm-workspace.yaml` only holds pnpm policies.

This file keeps the commands, the map, and the hard rules. Detailed explanations live in `docs/`.

## Commands

There is no CI in this repo. The local gate is the only verification:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

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
| `src/lib/games/*`, `src/lib/league/*` | Pure domain engines (state machines, scoring, capabilities). No DB or IO; unit-tested. |
| `src/lib/db/client.ts` | `withDbRead`, `withDbWrite`, `withDbRetry`, pool configuration, global concurrency gate. |
| `src/lib/cache/` | `lifetimes.ts` (cache profiles), `deferred.ts` (post-commit invalidation). |
| `src/db/schema.ts` | Schema source of truth. Migrations live in `supabase/migrations/`. |
| `src/data/` | JSON seed fixtures (spots, TV, tricks, taxonomy, RBAC). |
| `.agents/specs/` | Feature specs for the league (`league/`) and games UX. Read the relevant one before touching that code. |
| `DESIGN.md` | Design tokens and UI system. |

## Hard rules

### Architecture (`docs/architecture.md`)

- Pages and route handlers never import Drizzle or `@/db/schema`. The flow is always page/route → service → repository.
- Get repositories from `@/lib/repositories` (proxies or `get<Entity>RepositoryAsync()`), never by constructing a Drizzle implementation.
- Game and league mutations go through their services: `withDbWrite` + `db.transaction` + `expectedVersion` OCC + an idempotent `requestFingerprint` + a realtime signal row.
- Any new `RESTRICT` foreign key to `spots` must be handled in `detachSpotDependents`.
- Import canonical paths. About 65 files in `src/lib`, `src/lib/services`, and `src/lib/repositories` are `@deprecated` one-line re-export shims, for example `@/lib/safe-fetch` → `@/lib/utils/safe-fetch` and `@/lib/supabase/storage` → `@/lib/storage`.
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

- Applied migrations are immutable; fixes ship as new files. Generate them with `pnpm exec drizzle-kit generate`.
- Never expose `SUPABASE_SECRET_KEY`. Only `getAdminClient()` (`src/lib/auth/auth.ts`) and `src/lib/supabase/admin.ts` may read it.

### UI (`docs/ui-conventions.md`, `DESIGN.md`)

- No `animate-pulse` outside skeleton and loading components.
- Form controls are at least 16px on mobile (`text-base sm:text-sm`). Never set `maximum-scale` or `user-scalable=no`.
- The dark map palette applies only to the map canvas and on-map overlays.
- The warm gradient is reserved for the Home hero and the Games landing page.
- Keep Next image optimization off (`unoptimized: true`); images come straight from the R2 CDN.

## Docs

- `docs/architecture.md`: request lifecycle, layers, repositories, write path, deletion lifecycle, error mapping, security headers.
- `docs/caching-and-egress.md`: Cache Components, invalidation, the Supabase egress budget, RSC payloads, polling.
- `docs/database.md`: environment, migrations, seeding, RBAC/RLS, realtime, storage.
- `docs/ui-conventions.md`: UI rules and component organization.
