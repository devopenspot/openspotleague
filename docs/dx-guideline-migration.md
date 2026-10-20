# OpenSpot Migration & Seed DX Guideline

A concise developer experience guide for running and managing the OpenSpot database migration and seeding pipeline.

---

## 1. Quick Start

To execute a clean, from-scratch migration and deterministic seed:

```bash
pnpm db:fresh:seed
```

This single command executes the full pipeline:
1. `pnpm db:reset` — Drops application tables, triggers, and functions.
2. `pnpm db:apply` — Applies SQL baseline and pending migrations with advisory locks.
3. `pnpm db:seed` — Seeds core taxonomies, RBAC roles, all 28,137 spots, and bootstraps the admin user.
4. `pnpm db:seed-tv` — Seeds 282 curated TV videos.
5. `pnpm db:seed-tricks` — Snapshots 664 tricks across all 4 disciplines.

---

## 2. Prerequisites & Environment Setup

Ensure your `.env.local` contains the required database, auth, and storage credentials:

```bash
# Direct PostgreSQL connection (port 5432) — required for reset and DDL
SUPABASE_DIRECT_URL="postgres://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require"

# PgBouncer Transaction pooler (port 6543) — used by runtime client
SUPABASE_DATABASE_URL="postgres://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"

# Supabase Auth credentials
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."

# Admin Bootstrap Email (devopenspot@gmail.com is also automatically guaranteed by fallback)
ADMIN_EMAILS="devopenspot@gmail.com"

# Cloudflare R2 / CDN settings
STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_SPOTS="openspotleague-spots"
R2_PUBLIC_DOMAIN_SPOTS="spots.cdn.openspotleague.com"
```

---

## 3. Individual Step-by-Step Commands

If you need to run specific phases independently:

### Step 1: Database Reset
Drops all application tables (including `short_links`), triggers, and reset migration ledgers:
```bash
pnpm db:reset
```

### Step 2: Apply Migrations
Applies pending SQL migrations in `supabase/migrations/` using session advisory locking:
```bash
pnpm db:apply
```

### Step 3: Seed Core Data & Spots
Populates regions, countries, taxonomies, RBAC roles, migrates all 28,137 spots from `src/data/spots.json`, bootstraps the admin role, and re-analyzes table statistics:
```bash
pnpm db:seed
```

### Step 4: Seed TV Videos
Populates 282 TV videos from `src/data/videos_tv.json`:
```bash
pnpm db:seed-tv
```

### Step 5: Seed Trick Catalogs
Populates trick catalogs from `src/data/tricks/*.json`:
```bash
pnpm db:seed-tricks
# Or per discipline:
# pnpm db:seed-tricks:skateboard
# pnpm db:seed-tricks:bmx
# pnpm db:seed-tricks:scooter
# pnpm db:seed-tricks:roller
```

---

## 4. Maintenance & Diagnostic Tools

### Offline Spots Validation (No DB Required)
Validates `src/data/spots.json` coordinates, country codes, types, and images offline:
```bash
pnpm db:migrate-spots validate
```

### Refresh / Upsert Existing Spots
If you edit spots in `src/data/spots.json` and want to update the database without resetting:
```bash
pnpm db:migrate-spots --upsert
```

### Admin Role Verification & Bootstrap
Verifies or creates the `devopenspot@gmail.com` admin user anytime:
```bash
pnpm db:bootstrap-admin
# Or for a specific email:
# pnpm db:bootstrap-admin user@example.com
```

### Cloudflare CDN Reachability Check
Tests HTTP 200 responses and variants (`_400.webp`, `_128.webp`) on `spots.cdn.openspotleague.com`:
```bash
# Test sample of 50 images:
pnpm db:verify-cdn --limit 50

# Test all images:
pnpm db:verify-cdn --all
```

### Database Health Check
Validates connection latency, statement timeout settings, and realtime replication status:
```bash
pnpm db:health
```

---

## 5. Built-in Safeguards & Architecture Rules

1. **Admin Role Guarantee (`devopenspot@gmail.com`)**:
   - **Seed Level**: If `devopenspot@gmail.com` is not found in `auth.users`, it is auto-created using the Supabase Admin API.
   - **Runtime Level**: When `devopenspot@gmail.com` logs in, profile provisioning automatically grants the `admin` role Just-In-Time if it was missing.
2. **Statement Timeout Protection**:
   - Spot migration elevates `statement_timeout` to `300s` during bulk insertion to prevent the 8s serverless limit from terminating large transactions or deferred trigger checks (`spots_require_discipline`).
3. **Query Planner Optimization**:
   - `ANALYZE` is automatically executed on `spots`, `spot_disciplines`, `spot_type_assignments`, and `spot_images` after seeding so queries on the map and landing pages use optimal index scans.
4. **Cloudflare CDN Consistency**:
   - All spot images reference `https://spots.cdn.openspotleague.com/spots/{spotId}/{uuid}.webp`.
   - Relative paths stored in `spot_images.path` seamlessly resolve to Cloudflare CDN variants (`_400.webp` for cards, `_800.webp` for detail).
