-- Phase 2: invisible perf indexes — no UX change, no cost
-- All tables already exist; use IF NOT EXISTS so re-apply is safe.
-- Keep outside a single huge transaction-safe block: `pnpm db:apply` uses
-- advisory-locked transaction, so avoid CONCURRENTLY (not allowed in tx).

-- Full-text-like search uses `lower(col) LIKE '%term%'` which is seq-scan.
-- pg_trgm GIN gives indexed LIKE/ILIKE without changing query text.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS spots_name_trgm_idx ON spots USING gin (lower(name) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS spots_city_trgm_idx ON spots USING gin (lower(city) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS spots_address_trgm_idx ON spots USING gin (lower(address) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sport_events_name_trgm_idx ON sport_events USING gin (lower(name) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sport_events_city_trgm_idx ON sport_events USING gin (lower(city) gin_trgm_ops);
--> statement-breakpoint

-- Cover EXISTS (discipline_slug = ? AND spot_id = ?) without heap fetch.
-- PK is (spot_id, discipline_slug) — reverse order supports the filtered EXISTS.
CREATE INDEX IF NOT EXISTS spot_disciplines_discipline_spot_idx ON spot_disciplines (discipline_slug, spot_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS spot_type_assignments_type_spot_idx ON spot_type_assignments (type_slug, spot_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS event_disciplines_discipline_event_idx ON event_disciplines (discipline_slug, event_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS challenge_trick_spot_types_slug_idx ON challenge_trick_spot_types (spot_type_slug);
--> statement-breakpoint
