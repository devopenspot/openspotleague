-- 0007: League divisions and the Article 9 rating engine.
-- A contest now runs one or more divisions (discipline × format: park,
-- street, vert). Riders enter divisions; each division has its own runs,
-- standings and results. Contests choose a submission mode: live (organizer
-- windows) or video (rider links until a deadline). Judges score 5 criteria
-- 0-10 (0.5 steps) → 0-100, tick required elements, and score the Street
-- best trick. See docs/league.md, "Rating".
--
-- Backfill keeps every existing contest working: each one gets an `open`
-- (legacy) division per discipline; the first owns the existing runs,
-- results, criteria and rider entries, so old scores and points are intact.
-- "First division" = lowest sort_order per contest (only `open` rows exist
-- while this file runs).

-- ---------- sport_events: submission mode ----------
ALTER TABLE "sport_events" ADD COLUMN IF NOT EXISTS "submission_mode" text DEFAULT 'live' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sport_events" ADD COLUMN IF NOT EXISTS "submission_deadline_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sport_events" ADD CONSTRAINT "sport_events_submission_mode_check" CHECK ("sport_events"."submission_mode" in ('live','video'));
--> statement-breakpoint
ALTER TABLE "sport_events" ADD CONSTRAINT "sport_events_video_deadline_check" CHECK ("sport_events"."submission_mode" = 'live' or "sport_events"."submission_deadline_at" is not null);
--> statement-breakpoint

-- ---------- event_memberships: rider entry info ----------
ALTER TABLE "event_memberships" ADD COLUMN IF NOT EXISTS "age_category" text;
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD COLUMN IF NOT EXISTS "gender" text;
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD COLUMN IF NOT EXISTS "rider_city" text;
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_age_category_check" CHECK ("event_memberships"."age_category" is null or "event_memberships"."age_category" in ('junior','senior'));
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_gender_check" CHECK ("event_memberships"."gender" is null or length("event_memberships"."gender") between 1 and 40);
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_rider_city_check" CHECK ("event_memberships"."rider_city" is null or length("event_memberships"."rider_city") between 1 and 80);
--> statement-breakpoint

-- ---------- divisions ----------
CREATE TABLE IF NOT EXISTS "event_divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"discipline_slug" text NOT NULL,
	"format" text NOT NULL,
	"run_seconds" integer,
	"has_best_trick" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_divisions_event_discipline_format_unique" UNIQUE("event_id","discipline_slug","format"),
	CONSTRAINT "event_divisions_format_check" CHECK ("event_divisions"."format" in ('park','street','vert','open')),
	CONSTRAINT "event_divisions_run_seconds_check" CHECK ("event_divisions"."run_seconds" is null or "event_divisions"."run_seconds" > 0),
	CONSTRAINT "event_divisions_sort_order_check" CHECK ("event_divisions"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "event_divisions" ADD CONSTRAINT "event_divisions_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_divisions" ADD CONSTRAINT "event_divisions_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_divisions_event_idx" ON "event_divisions" USING btree ("event_id","sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_division_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"division_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_division_entries_membership_division_unique" UNIQUE("membership_id","division_id")
);
--> statement-breakpoint
ALTER TABLE "event_division_entries" ADD CONSTRAINT "event_division_entries_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_division_entries" ADD CONSTRAINT "event_division_entries_division_id_event_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."event_divisions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_division_entries" ADD CONSTRAINT "event_division_entries_membership_id_event_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."event_memberships"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_division_entries_division_idx" ON "event_division_entries" USING btree ("division_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_division_entries_event_idx" ON "event_division_entries" USING btree ("event_id");
--> statement-breakpoint

-- ---------- backfill: one `open` division per existing discipline ----------
INSERT INTO "event_divisions" ("event_id", "discipline_slug", "format", "sort_order")
SELECT d."event_id", d."discipline_slug", 'open',
       (row_number() OVER (PARTITION BY d."event_id" ORDER BY d."discipline_slug") - 1)::int
FROM "event_disciplines" d
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Contests with no discipline row (not creatable through the app, which needs
-- at least one) still need a division to own their runs: use 'roller'.
INSERT INTO "event_divisions" ("event_id", "discipline_slug", "format", "sort_order")
SELECT e."id", 'roller', 'open', 0
FROM "sport_events" e
WHERE NOT EXISTS (SELECT 1 FROM "event_divisions" v WHERE v."event_id" = e."id")
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "event_division_entries" ("event_id", "division_id", "membership_id")
SELECT m."event_id", f."division_id", m."id"
FROM "event_memberships" m
JOIN (SELECT DISTINCT ON ("event_id") "event_id", "id" AS "division_id" FROM "event_divisions" ORDER BY "event_id", "sort_order", "id") f ON f."event_id" = m."event_id"
WHERE m."role" = 'rider'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------- criteria: legacy rows belong to the open division ----------
ALTER TABLE "event_scoring_criteria" ADD COLUMN IF NOT EXISTS "division_id" uuid;
--> statement-breakpoint
ALTER TABLE "event_scoring_criteria" ADD CONSTRAINT "event_scoring_criteria_division_id_event_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."event_divisions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
UPDATE "event_scoring_criteria" c SET "division_id" = f."division_id"
FROM (SELECT DISTINCT ON ("event_id") "event_id", "id" AS "division_id" FROM "event_divisions" ORDER BY "event_id", "sort_order", "id") f WHERE f."event_id" = c."event_id" AND c."division_id" IS NULL;
--> statement-breakpoint

-- ---------- runs: division, video links, submitted status ----------
ALTER TABLE "event_runs" ADD COLUMN IF NOT EXISTS "division_id" uuid;
--> statement-breakpoint
ALTER TABLE "event_runs" ADD COLUMN IF NOT EXISTS "video_url" text;
--> statement-breakpoint
ALTER TABLE "event_runs" ADD COLUMN IF NOT EXISTS "best_trick_video_url" text;
--> statement-breakpoint
ALTER TABLE "event_runs" ADD COLUMN IF NOT EXISTS "video_submitted_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "event_runs" r SET "division_id" = f."division_id"
FROM (SELECT DISTINCT ON ("event_id") "event_id", "id" AS "division_id" FROM "event_divisions" ORDER BY "event_id", "sort_order", "id") f WHERE f."event_id" = r."event_id" AND r."division_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "event_runs" ALTER COLUMN "division_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_division_id_event_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."event_divisions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_runs" DROP CONSTRAINT IF EXISTS "event_runs_event_membership_stage_unique";
--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_event_membership_division_stage_unique" UNIQUE("event_id","membership_id","division_id","stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_runs_division_idx" ON "event_runs" USING btree ("division_id");
--> statement-breakpoint
ALTER TABLE "event_runs" DROP CONSTRAINT IF EXISTS "event_runs_status_check";
--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_status_check" CHECK ("event_runs"."status" in ('scheduled','submitted','judging','scored','skipped','completed'));
--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_video_url_check" CHECK ("event_runs"."video_url" is null or length("event_runs"."video_url") between 1 and 500);
--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_best_trick_video_url_check" CHECK ("event_runs"."best_trick_video_url" is null or length("event_runs"."best_trick_video_url") between 1 and 500);
--> statement-breakpoint

-- ---------- scores: best trick and element checklist ----------
ALTER TABLE "event_scores" ADD COLUMN IF NOT EXISTS "best_trick" jsonb;
--> statement-breakpoint
ALTER TABLE "event_scores" ADD COLUMN IF NOT EXISTS "best_trick_total" numeric(8, 2);
--> statement-breakpoint
ALTER TABLE "event_scores" ADD COLUMN IF NOT EXISTS "elements" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint

-- ---------- results: one ranking per division ----------
ALTER TABLE "event_results" ADD COLUMN IF NOT EXISTS "division_id" uuid;
--> statement-breakpoint
ALTER TABLE "event_results" ADD COLUMN IF NOT EXISTS "best_trick_score" numeric(8, 2);
--> statement-breakpoint
UPDATE "event_results" r SET "division_id" = f."division_id"
FROM (SELECT DISTINCT ON ("event_id") "event_id", "id" AS "division_id" FROM "event_divisions" ORDER BY "event_id", "sort_order", "id") f WHERE f."event_id" = r."event_id" AND r."division_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "event_results" ALTER COLUMN "division_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_division_id_event_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."event_divisions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_results" DROP CONSTRAINT IF EXISTS "event_results_event_user_unique";
--> statement-breakpoint
ALTER TABLE "event_results" DROP CONSTRAINT IF EXISTS "event_results_event_rank_unique";
--> statement-breakpoint
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_division_user_unique" UNIQUE("division_id","user_id");
--> statement-breakpoint
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_division_rank_unique" UNIQUE("division_id","rank");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_results_event_idx" ON "event_results" USING btree ("event_id");
--> statement-breakpoint

-- ---------- points ledger: ranking filter dimensions ----------
ALTER TABLE "event_points_ledger" ADD COLUMN IF NOT EXISTS "division_id" uuid;
--> statement-breakpoint
ALTER TABLE "event_points_ledger" ADD COLUMN IF NOT EXISTS "discipline_slug" text;
--> statement-breakpoint
ALTER TABLE "event_points_ledger" ADD COLUMN IF NOT EXISTS "format" text;
--> statement-breakpoint
ALTER TABLE "event_points_ledger" ADD COLUMN IF NOT EXISTS "country_code" text;
--> statement-breakpoint
ALTER TABLE "event_points_ledger" ADD CONSTRAINT "event_points_ledger_division_id_event_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."event_divisions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
UPDATE "event_points_ledger" l SET "country_code" = e."country_code"
FROM "sport_events" e WHERE e."id" = l."event_id" AND l."country_code" IS NULL;
--> statement-breakpoint
UPDATE "event_points_ledger" l
SET "division_id" = v."id", "discipline_slug" = v."discipline_slug", "format" = v."format"
FROM (SELECT DISTINCT ON ("event_id") "event_id", "id" AS "division_id" FROM "event_divisions" ORDER BY "event_id", "sort_order", "id") f
JOIN "event_divisions" v ON v."id" = f."division_id"
WHERE f."event_id" = l."event_id" AND l."event_type" = 'event_rank_bonus' AND l."division_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_points_ledger_filters_idx" ON "event_points_ledger" USING btree ("discipline_slug","format","country_code","user_id");
