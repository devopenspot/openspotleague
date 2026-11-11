# OpenSpot

OpenSpot is an interactive map of action-sports spots (skateboard, BMX, scooter, roller), with:

- the League: user-created and curated contests with divisions, QR invites, live or video judging on the five World Skate criteria, standings, a global ranking and league points (`/league`)
- multiplayer trick-challenge games
- curated action sports TV

Stack: Next.js 16 (App Router, Cache Components) and React 19 on vinext (Vite), deployed to Cloudflare Workers; Supabase (Postgres + PostGIS, Auth, Realtime) through Hyperdrive, Drizzle ORM, Cloudflare R2 for media, Tailwind CSS 4, Leaflet, and Vitest.

## Getting started

Requirements: Node 22 (`.nvmrc`) and pnpm 12.16.1 (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase, R2, and weather credentials
pnpm db:fresh:seed           # reset, migrate, and seed a NON-production database
pnpm dev
```

> Use a separate Supabase project, branch, or local instance for development. A `.env.local` that points at the production pooler bills production egress. See [docs/caching-and-egress.md](docs/caching-and-egress.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Vite dev server, production build (needs no DB), and production preview in `workerd` |
| `pnpm deploy` / `pnpm deploy:secrets` | Deploy to Cloudflare; the second also uploads the declared secrets from `.env.local` |
| `pnpm deploy:response-store` | Deploy the cache Worker |
| `pnpm lint` | ESLint on `src` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm db:*` | Migrations, seeding, and diagnostics; see [docs/database.md](docs/database.md) |

Run `pnpm lint && pnpm typecheck && pnpm test` before pushing; CI runs the same gate on every pull request. See [AGENTS.md](AGENTS.md#commands) for the full command reference.

## Delivery

Trunk-based: short branch → pull request → squash merge to `main` → automatic deploy to develop (`dev.openspotleague.com`) → manual, approved release to production (`openspotleague.com`). Details: [docs/ci-cd.md](docs/ci-cd.md), [docs/environments.md](docs/environments.md), [docs/feature-flags.md](docs/feature-flags.md).

## Project layout

```
src/
  app/            routes and API handlers (App Router)
  proxy.ts        Next 16 proxy: rate limiting, auth refresh, security headers
  components/     UI components
  hooks/          client hooks (data, map, preferences, ui)
  lib/
    services/     business logic and the single writers
    repositories/ data-access interfaces + Drizzle implementations
    games/ league/ pure domain engines
    db/ cache/    DB client and cache helpers
  db/             schema, migration runner, seed scripts
  data/           JSON seed fixtures
supabase/migrations/  SQL migrations
```

## Pending work

- Finish the environment rollout in [docs/environments.md](docs/environments.md#one-time-setup) (develop Worker, production cut-over).
- Remove the leftover Vercel GitHub integration, whose check fails on pull requests.
- Review the drafted required-element lists for Skateboard, BMX and Scooter (`src/lib/league/rating/elements.ts`, `REVIEW_PENDING`).

## Documentation

- [AGENTS.md](AGENTS.md): rules for coding agents and contributors
- [docs/ci-cd.md](docs/ci-cd.md), [docs/environments.md](docs/environments.md), [docs/feature-flags.md](docs/feature-flags.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/caching-and-egress.md](docs/caching-and-egress.md)
- [docs/league.md](docs/league.md)
- [docs/database.md](docs/database.md)
- [docs/ui-conventions.md](docs/ui-conventions.md)
- [DESIGN.md](DESIGN.md): design system
