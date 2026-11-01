# OpenSpot

OpenSpot is an interactive map of action-sports spots (skateboard, BMX, scooter, roller), with:

- community and editorial events (the league)
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
| `pnpm lint` | ESLint on `src` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm db:*` | Migrations, seeding, and diagnostics; see [docs/database.md](docs/database.md) |

There is no CI. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing.

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
.agents/specs/        feature specs (league, games)
```

## Documentation

- [AGENTS.md](AGENTS.md): rules for coding agents and contributors
- [docs/architecture.md](docs/architecture.md)
- [docs/caching-and-egress.md](docs/caching-and-egress.md)
- [docs/database.md](docs/database.md)
- [docs/ui-conventions.md](docs/ui-conventions.md)
- [DESIGN.md](DESIGN.md): design system
