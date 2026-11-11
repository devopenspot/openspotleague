# Database

PostgreSQL on Supabase with the `postgis`, `pgcrypto`, and `pg_trgm` extensions, accessed through Drizzle ORM. The schema source of truth is `src/db/schema.ts`, which re-exports `src/db/schema/index.ts`. Per-domain barrels live in `src/db/schema/{auth,games,spots,taxonomy}.ts`.

## Environment

Copy `.env.example` to `.env.local`; the comments in that file document each variable. The ones the database depends on:

| Variable | Purpose |
| --- | --- |
| `HYPERDRIVE` binding | The Worker's only route to Postgres. Declared in `cloudflare.config.ts`, and never a URL in the Worker's env. |
| `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` | Where the binding connects under `pnpm dev` and `pnpm start`. Include `sslmode=require`. |
| `SUPABASE_DATABASE_URL` | Transaction pooler (`:6543`) for Node scripts. Never set it on the Worker. |
| `SUPABASE_DIRECT_URL` | Direct or session connection (`:5432`) for DDL, reset, and seeding. Never set it on the Worker. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe auth keys. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Server-only privileged access. |
| `ADMIN_EMAILS` | Comma-separated emails granted `admin` during `pnpm db:seed`. |
| `DB_*` | Optional pool tuning; see `architecture.md`. |

How each tool picks its connection string:

- **Runtime.** `getDatabaseUrl()` (`src/lib/config/env.ts`) uses the Hyperdrive binding on Workers. On Node it tries `SUPABASE_DATABASE_URL` first, then `SUPABASE_DIRECT_URL`.
- **`drizzle.config.ts`.** Tries `SUPABASE_DIRECT_URL`, then `DB_CONNECTION_STRING`, then `DATABASE_URL`. If it finds the misspelled `DB_CONNETION_STRING`, it throws.
- **CLI scripts.** They import `src/db/load-env.ts`, which loads `.env.local` with `override: true` and then `.env` with `override: false`. As a result, `.env.local` wins even over variables exported in your shell.

> Don't point `.env.local` at the production pooler while developing; see `caching-and-egress.md`.

## Migrations

- SQL lives in `supabase/migrations/`. `0000_baseline.sql` creates the 59 baseline tables, and later numbered files apply on top of it. For example, `0003_drop_spot_disciplines.sql` moved disciplines into `spots.sports text[]`.
- Write new migrations by hand as the next numbered file. `supabase/migrations/meta/_journal.json` stops at `0002` and there are no drizzle snapshots, so `drizzle-kit generate` would emit the whole schema; `0003`–`0007` were all hand-written.
- Apply migrations with `pnpm db:apply` (`src/db/apply-sql.ts`). It holds a session advisory lock (`hashtextextended('openspot:database-apply', 0)`) and records progress in `schema_migrations` using normalized per-statement SHA-256 hashes (`detectMigrationDrift`). Old-format ledger hashes are rewritten in place and logged with `↻`.
- **Applied migrations are immutable.** Ship any fix as a new migration file.
- League migrations `0005_contests_drop_origin`, `0006_contest_curator_role` and `0007_league_divisions_rating` are described in [`docs/league.md`](league.md#data-model).
- `0009_notification_delivery` turns `user_notifications` into the email outbox, adds per-category email preferences, and retires the pg_cron email sweep (`league_email_sweep`, `league_email_log`). See [`docs/notifications.md`](notifications.md). After applying it in production, delete the unused Vault secrets `resend_api_key` and `email_from`.
- `0010_event_signal_trigger_deferred` makes the `sport_events` realtime signal trigger deferred, so the League service's specific signal types are no longer overwritten by the generic one (see Realtime below).

## Seeding

```bash
pnpm db:fresh        # db:reset + db:apply
pnpm db:fresh:seed   # db:reset + db:apply + db:seed + db:seed-tv + db:seed-tricks
```

| Command | What it does |
| --- | --- |
| `pnpm db:reset` | Drops application tables, triggers, functions, and the migration ledger. |
| `pnpm db:seed` | Seeds regions, countries, taxonomy (spot types, disciplines, event categories, tiers, plans), RBAC, and all spots from `src/data/spots.json` (28,137). Grants `admin` to existing auth users listed in `ADMIN_EMAILS`; `devopenspot@gmail.com` is always added. |
| `pnpm db:seed-tv` | Seeds TV videos from `src/data/videos_tv.json` (498). |
| `pnpm db:seed-tricks [discipline]` | Seeds trick catalogs from `src/data/tricks/*.json` for all disciplines, or just one. Shortcuts: `db:seed-tricks:{skateboard,bmx,scooter,roller}`. |
| `pnpm db:migrate-spots [--dry-run] [--limit N]` | Spots-only import. `--dry-run` validates offline without touching the database. |
| `pnpm db:curate-cities` | Curates the cities dataset. |
| `pnpm db:bootstrap-admin [email]` | Grants admin to a single user. |

Trick catalogs use replace-and-snapshot semantics: the JSON fixture is the source of truth, and any trick missing from it is removed when you seed. Seeding is implemented in `seedChallengeCatalogForDiscipline` (`src/db/seed-data/challenge-catalogs.ts`).

## Diagnostics

| Command | Purpose |
| --- | --- |
| `pnpm db:health` | Checks connectivity, latency, PostGIS, and the migration ledger. |
| `pnpm db:check-pool` | Inspects pool behavior. |
| `pnpm egress:snapshot` | Egress investigation. Use this instead of Supabase logs. |
| `pnpm db:verify-cdn` | Checks that image assets exist on the CDN. |
| `pnpm db:verify-game-lifecycle` | End-to-end check of the challenge game lifecycle. |
| `pnpm db:studio` | Drizzle Studio. |

## RBAC and RLS

- RBAC is defined in `src/data/rbac.json` and stored in the `permissions`, `roles`, `role_permissions`, and `user_roles` tables.
- Roles:
  - `admin`
  - `curator` (legacy)
  - `spot_curator` and `contest_curator`, scoped by country through `curator_country_scopes`. For `contest_curator` permissions see [`docs/league.md`](league.md#contest-curation).
  - `trick_curator`, scoped by discipline through `curator_discipline_scopes`
- RLS policies:
  - `spots_public_read`: public spots that are not admin-hidden; personal spots only for their creator.
  - `sport_events_public_read`: public contests; unlisted (free-plan) contests only for their creator. Members reach unlisted contests through the league service, never through RLS.
  - `user_notifications_owner`, `user_email_preferences_owner`: rows belong to the owner only.
  - League child tables (`event_divisions`, `event_division_entries`, `event_runs`, `event_scores`, …) have no RLS policies: they are read and written only by the server through Drizzle, which applies the role projection (`src/lib/league/visibility.ts`).

## Realtime

The `supabase_realtime` publication includes `user_notifications`, `game_realtime_signals`, and `event_realtime_signals`.

Version bumps on `sport_events` and `game_sessions` also emit a signal row from a trigger, as a safety net for writes that record none. The `sport_events` trigger is a deferred constraint trigger (0009): it fires at commit, so the League service's specific `signal_type` (`score_submitted`, `results_published`, …) wins the unique `(event_id, version)` slot and the trigger's generic row only fills gaps. Clients refetch on any newer version and do not read `signal_type` today.

## Storage

- Cloudflare R2 is the object store (`STORAGE_PROVIDER=r2`). The buckets are `R2_BUCKET_SPOTS` and `R2_BUCKET_EVENTS`; the events bucket holds contest covers (`uploadEventImage`, `/api/league/events/[id]/cover`).
- Uploads go through `src/lib/storage/index.ts`. Where Sharp loads, `processImageBuffer` (`src/lib/storage/process.ts`) writes 128, 400, and 800 px WebP variants. Sharp does not load on Workers, so there it stores the original file and points every variant path at it.
- Images are served directly from `spots.cdn.openspotleague.com` and `events.cdn.openspotleague.com`, so image traffic adds nothing to database egress.
- `src/lib/supabase/storage.ts` is a deprecated shim; import `@/lib/storage` instead.
