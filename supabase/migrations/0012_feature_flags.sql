-- 0012: feature flag overrides (docs/feature-flags.md). Flags and their
-- per-environment defaults are declared in code (src/lib/flags/registry.ts).
-- A row here overrides the default in this database only, so develop and
-- production are toggled independently. No row: the code default applies.
--
-- Expand-only: nothing reads or drops existing objects, so the code that is
-- live when this applies keeps working.
--
-- Server-only (Drizzle as the table owner). RLS on with no policies keeps it
-- out of the Supabase Data API.

CREATE TABLE IF NOT EXISTS "feature_flags" (
  "key" text PRIMARY KEY,
  "enabled" boolean NOT NULL,
  "rollout_percent" integer NOT NULL DEFAULT 100,
  "allow_user_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[],
  "allow_roles" text[] NOT NULL DEFAULT '{}'::text[],
  "updated_by" uuid,
  "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "feature_flags_key_check" CHECK ("key" ~ '^[a-z][a-zA-Z0-9]{1,63}$'),
  CONSTRAINT "feature_flags_rollout_percent_check" CHECK ("rollout_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "feature_flags" ENABLE ROW LEVEL SECURITY;
