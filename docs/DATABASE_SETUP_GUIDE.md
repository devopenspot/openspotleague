# OpenSpot Database Setup & Migration Guide

Comprehensive guideline for provisioning, configuring, and seeding a brand-new Supabase instance for OpenSpot.

---

## 1. Overview

The OpenSpot database runs on PostgreSQL 15+ via Supabase. The database architecture consists of:
- **A Single Consolidated Fresh Baseline Migration** (`supabase/migrations/0000_baseline.sql`) that provisions all 59 application tables, indexes, functions, triggers, storage buckets, and security policies in a single run.
- **Deterministic Seed Scripts** based on the canonical JSON data fixtures in `src/data`:
  - `src/data/spots.json` (28,137 spots, disciplines, types, and images)
  - `src/data/videos_tv.json` (282 curated TV videos)
  - `src/data/tricks/*.json` (Trick catalogs for skateboard, BMX, scooter, roller)
- **Role-Based Access Control (RBAC)** and **Row-Level Security (RLS)** protecting public vs. personal content.

---

## 2. Supabase Project Provisioning

When creating a new project in the [Supabase Dashboard](https://supabase.com/dashboard):

1. **Organization & Name**: Select your organization and set a project name (e.g., `openspot-prod` or `openspot-staging`).
2. **Region**: Choose a region close to your primary user base (e.g., `us-east-1` or `eu-central-1`).
3. **Database Password**: Generate a strong password and store it securely.
4. **PostgreSQL Version**: 15 or higher.

### Required PostgreSQL Extensions

The baseline migration automatically ensures necessary extensions, but verify under **Database → Extensions**:
- `postgis` (enabled in `public` schema for geospatial `geography(Point, 4326)` calculations)
- `pgcrypto` (for UUID and cryptographic hash utilities)
- `pg_net` (optional; used if automated email sweep is enabled)
- `pg_cron` (optional; used if daily digest sweep is enabled)
- `vault` (optional; stores encrypted Resend API secrets)

---

## 3. Environment Variables Reference

Configure these environment variables in your deployment environment (Vercel, container) and in `.env.local` for local execution.

| Variable | Description | Example / Format | Safe for Browser? |
| :--- | :--- | :--- | :--- |
| `SUPABASE_DATABASE_URL` | **Transaction mode pooler** connection string (port `6543`). Used by Next.js server runtime. | `postgres://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require` | ❌ Server Only |
| `SUPABASE_DIRECT_URL` | **Direct connection** string (port `5432`) or session pooler. Required for DDL migrations (`pnpm db:apply`). | `postgres://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require` | ❌ Server Only |
| `NEXT_PUBLIC_SUPABASE_URL` | Public API URL for your Supabase project. | `https://[project-ref].supabase.co` | ✅ Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon / Publishable API key. | `sb_publishable_...` | ✅ Public |
| `SUPABASE_SECRET_KEY` | Supabase Service Role Secret Key (admin privileges). | `sb_secret_...` | ❌ Server Only (Privileged) |
| `ADMIN_EMAILS` | Comma-separated emails to automatically grant `admin` role during `pnpm db:seed`. | `admin@openspot.com,dev@openspot.com` | ❌ Server Only |
| `STORAGE_PROVIDER` | Object storage provider plane. Options: `r2` or `supabase`. | `r2` | ❌ Server Only |
| `CDN_BASE_URL` | Base public URL serving spot and event images. | `https://spots.cdn.openspotleague.com` | ✅ Public |

> [!WARNING]
> Never expose `SUPABASE_SECRET_KEY` or database connection strings to client-side code or git commits.

---

## 4. Execution Workflow (Step-by-Step)

Once your `.env.local` is configured with `SUPABASE_DIRECT_URL` and `SUPABASE_DATABASE_URL`, execute the database setup in the following sequence:

### Step 1: Apply Database Migration

```bash
pnpm db:apply
```
- Applies `supabase/migrations/0000_baseline.sql`.
- Uses an advisory lock (`openspot:database-apply`) and records the hash in `schema_migrations`.
- Creates all 59 tables, foreign keys, PostGIS geography indexes, keyset indexes, stored procedures, triggers, views, and storage buckets.

### Step 2: Seed Base Taxonomy & Spots

```bash
pnpm db:seed
```
- Seeds regions (12 global macro-regions).
- Seeds countries (139 ISO countries linked to regions).
- Seeds dimension taxonomies (spot types, sport disciplines, event categories, event tiers, event plans).
- Seeds RBAC system roles, permissions, and role-permission mappings.
- Seeds all **28,137 spots** from `src/data/spots.json`, creating spot records, join rows in `spot_disciplines`, join rows in `spot_type_assignments`, and image rows in `spot_images` for spots with photo assets.
- Bootstraps admin user profiles matching `ADMIN_EMAILS` if those users exist in Supabase Auth.

*(Optional)* You can run spots migration independently or validate the dataset offline:
```bash
# Offline dataset validation (no DB connection required)
pnpm db:migrate-spots --dry-run

# Run spots-only migration into the database
pnpm db:migrate-spots

# Migrate a test subset
pnpm db:migrate-spots --limit 100
```

### Step 3: Seed TV Videos

```bash
pnpm db:seed-tv
```
- Reads `src/data/videos_tv.json`.
- Seeds all **282 curated TV videos** across disciplines with category tags, publication status, and keyset ordering.

### Step 4: Seed Trick Catalogs (All Disciplines)

```bash
pnpm db:seed-tricks
```
- Seeds immutable trick catalogs and challenge snapshots for all 4 disciplines:
  - **Skateboard** (467 tricks)
  - **BMX** (64 tricks)
  - **Scooter** (77 tricks)
  - **Roller** (56 tricks)
- Generates catalog SHA-256 snapshots in `challenge_catalogs` and compatibility mappings in `challenge_trick_spot_types`.

*(Optional)* You can re-seed an individual discipline catalog at any time:
```bash
pnpm db:seed-tricks:skateboard
pnpm db:seed-tricks:bmx
pnpm db:seed-tricks:scooter
pnpm db:seed-tricks:roller
```

### Step 5: Verify Database Health

```bash
pnpm db:health
```
- Verifies database latency and connectivity.
- Confirms PostGIS version and spatial indexing.
- Checks `schema_migrations` ledger matches `0000_baseline`.
- Validates Supabase Realtime replication channels.

---

## 5. Security & Permissions Architecture

### Role-Based Access Control (RBAC)

The application models permissions via standard relational tables:
- `permissions`: Atomic capabilities (`content.read`, `content.write`, `media.manage`, `taxonomy.use`, `roles.manage`, `users.manage`, etc.)
- `roles`: Functional roles:
  - `admin`: Full unrestricted system administration.
  - `curator`: Legacy curated content access.
  - `spot_curator`: Country-scoped spot management (`curator_country_scopes`).
  - `event_curator`: Country-scoped event management.
  - `trick_curator`: Discipline-scoped trick catalog management (`curator_discipline_scopes`).
- `role_permissions`: Mapping of roles to granted permissions.
- `user_roles`: Assignment of roles to Supabase Auth users.

### Row-Level Security (RLS)

- **`spots`**:
  - `spots_public_read`: Public spots with `admin_hidden = false` are readable by anyone. Personal user spots (`visibility = 'personal'`) are visible strictly to their creator (`created_by = auth.uid()`).
- **`sport_events`**:
  - `sport_events_public_read`: Public events are readable by anyone; unlisted/draft events are visible to their creator.
- **`user_notifications`** & **`user_email_preferences`**:
  - Strictly scoped to the authenticated user (`user_id = auth.uid()`).
- **`spatial_ref_sys`**:
  - PostGIS reference table is locked down with RLS enabled and public read-only access to prevent unauthorized PostgREST modifications.

---

## 6. Storage & Media Architecture (Cloudflare R2)

OpenSpot uses Cloudflare R2 (`STORAGE_PROVIDER=r2`) as its object storage plane, eliminating any dependency on Supabase Storage buckets:
- **No Supabase Storage Buckets Required**: The database migration is 100% database-native and does not depend on the `storage` schema or bucket provisioning in Supabase.
- **R2 Buckets**:
  - `openspotleague-spots` (configured via `R2_BUCKET_SPOTS`)
  - `openspotleague-events` (configured via `R2_BUCKET_EVENTS`)
- **Sharp Image Processing**: Server-side image uploads generate 3 WebP variants:
  - `_128.webp` (thumbnail)
  - `_400.webp` (card)
  - `_800.webp` (detail view)
- **CDN Serving**: Images are served via Cloudflare CDN domains (`R2_PUBLIC_DOMAIN_SPOTS`, `R2_PUBLIC_DOMAIN_EVENTS` or `CDN_BASE_URL`), keeping database egress at zero.

---

## 7. Realtime Replication

The `supabase_realtime` publication broadcasts database changes for interactive features:
- `user_notifications` (in-app notifications delivery)
- `game_realtime_signals` (live challenge game session updates)
- `event_realtime_signals` (league event live scoring updates)

---

## 8. Summary of NPM Commands

| Command | Action |
| :--- | :--- |
| `pnpm db:apply` | Runs pending SQL migrations from `supabase/migrations/` |
| `pnpm db:seed` | Seeds regions, countries, dimensions, RBAC, admin users, and spots |
| `pnpm db:seed-tv` | Seeds TV videos from `src/data/videos_tv.json` |
| `pnpm db:seed-tricks` | Seeds trick catalogs for all disciplines |
| `pnpm db:seed-tricks:<discipline>` | Seeds trick catalog for a specific discipline (`skateboard`, `bmx`, `scooter`, `roller`) |
| `pnpm db:health` | Runs CLI database health and diagnostics report |
| `pnpm db:fresh` | Drops application tables and re-applies migration (`pnpm db:reset && pnpm db:apply`) |
| `pnpm db:fresh:seed` | Drops application tables, re-applies migration, and runs base seed (`pnpm db:reset && pnpm db:apply && pnpm db:seed`) |
