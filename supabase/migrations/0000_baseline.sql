-- OpenSpot unified fresh application baseline
--> statement-breakpoint
-- Generated for fresh Supabase instances. Clean schema without legacy seed/purge cycles.
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "regions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL DEFAULT '',
  "image_url" text,
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "regions_sort_order_idx" ON "regions" ("sort_order");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "countries" (
  "iso2" text PRIMARY KEY NOT NULL CHECK ("iso2" ~ '^[A-Z]{2}$'),
  "name" text NOT NULL UNIQUE CHECK (length("name") > 0),
  "iso3" text CHECK ("iso3" IS NULL OR "iso3" ~ '^[A-Z]{3}$'),
  "region_id" uuid NOT NULL REFERENCES "regions"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "countries_region_idx" ON "countries" ("region_id");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "spot_types" (
  "slug" text PRIMARY KEY NOT NULL CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX "spot_types_sort_order_idx" ON "spot_types" ("sort_order");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "sport_disciplines" (
  "slug" text PRIMARY KEY NOT NULL CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX "sport_disciplines_sort_order_idx" ON "sport_disciplines" ("sort_order");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "event_tiers" (
  "slug" text PRIMARY KEY NOT NULL CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX "event_tiers_sort_order_idx" ON "event_tiers" ("sort_order");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "event_categories" (
  "slug" text PRIMARY KEY NOT NULL CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX "event_categories_sort_order_idx" ON "event_categories" ("sort_order");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "event_plans" (
  "slug" text PRIMARY KEY NOT NULL CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "price_cents" integer NOT NULL CHECK ("price_cents" >= 0),
  "currency" text NOT NULL CHECK (length("currency") = 3),
  "max_participants" integer NOT NULL CHECK ("max_participants" > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX "event_plans_sort_order_idx" ON "event_plans" ("sort_order");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "display_name" text NOT NULL CHECK (length("display_name") > 0),
  "email" text NOT NULL CHECK ("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  "initials" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "distance_unit" text NOT NULL DEFAULT 'mi' CHECK ("distance_unit" IN ('mi', 'km')),
  "temperature_unit" text NOT NULL DEFAULT 'C' CHECK ("temperature_unit" IN ('C', 'F')),
  "preferred_discipline_slug" text REFERENCES "sport_disciplines"("slug") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX "profiles_preferred_discipline_idx" ON "profiles" ("preferred_discipline_slug");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "spots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "city" text NOT NULL CHECK (length("city") > 0),
  "city_slug" text NOT NULL CHECK (length("city_slug") > 0),
  "address" text NOT NULL,
  "image_url" text,
  "country_code" text NOT NULL REFERENCES "countries"("iso2") ON DELETE CASCADE,
  "instagram" text,
  "verification_count" integer NOT NULL DEFAULT 0 CHECK ("verification_count" >= 0),
  "visibility" text NOT NULL DEFAULT 'public' CHECK ("visibility" in ('personal','public')),
  "origin" text NOT NULL DEFAULT 'seed' CHECK ("origin" in ('seed','community','user_personal')),
  "community_submission_count" integer NOT NULL DEFAULT 0 CHECK ("community_submission_count" >= 0),
  "admin_hidden" boolean NOT NULL DEFAULT false,
  "types" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sports" text[] NOT NULL DEFAULT '{}'::text[],
  "location" geography(Point, 4326) NOT NULL,
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "spots_country_code_idx" ON "spots" ("country_code");
--> statement-breakpoint
CREATE INDEX "spots_city_slug_idx" ON "spots" ("city_slug");
--> statement-breakpoint
CREATE INDEX "spots_location_gist_idx" ON "spots" USING gist ("location");
--> statement-breakpoint
CREATE INDEX "spots_created_by_idx" ON "spots" ("created_by");
--> statement-breakpoint
CREATE INDEX "spots_visibility_idx" ON "spots" ("visibility");
--> statement-breakpoint
CREATE INDEX "spots_origin_idx" ON "spots" ("origin");
--> statement-breakpoint
CREATE INDEX "spots_admin_hidden_idx" ON "spots" ("admin_hidden");
--> statement-breakpoint
CREATE INDEX "spots_admin_hidden_visibility_idx" ON "spots" ("admin_hidden", "visibility");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "spot_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "path" text NOT NULL CHECK (length("path") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "spot_images_spot_path_key" UNIQUE ("spot_id", "path")
);
--> statement-breakpoint
CREATE INDEX "spot_images_spot_id_sort_order_idx" ON "spot_images" ("spot_id", "sort_order");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "spot_disciplines" (
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  PRIMARY KEY ("spot_id", "discipline_slug")
);
--> statement-breakpoint
CREATE INDEX "spot_disciplines_discipline_idx" ON "spot_disciplines" ("discipline_slug");
--> statement-breakpoint
CREATE INDEX "spot_disciplines_discipline_spot_idx" ON "spot_disciplines" ("discipline_slug", "spot_id");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "spot_type_assignments" (
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "type_slug" text NOT NULL REFERENCES "spot_types"("slug") ON DELETE RESTRICT,
  PRIMARY KEY ("spot_id", "type_slug")
);
--> statement-breakpoint
CREATE INDEX "spot_type_assignments_type_idx" ON "spot_type_assignments" ("type_slug");
--> statement-breakpoint
CREATE INDEX "spot_type_assignments_type_spot_idx" ON "spot_type_assignments" ("type_slug", "spot_id");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "community_spot_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "canonical_spot_id" uuid REFERENCES "spots"("id") ON DELETE SET NULL,
  "location" geography(Point, 4326) NOT NULL,
  "submission_hash" text NOT NULL CHECK (length("submission_hash") > 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "community_submissions_user_hash_unique" UNIQUE ("user_id", "submission_hash")
);
--> statement-breakpoint
CREATE INDEX "community_submissions_user_idx" ON "community_spot_submissions" ("user_id");
--> statement-breakpoint
CREATE INDEX "community_submissions_canonical_idx" ON "community_spot_submissions" ("canonical_spot_id");
--> statement-breakpoint
CREATE INDEX "community_submissions_location_gist_idx" ON "community_spot_submissions" USING gist ("location");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "saved_spots" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "spot_id")
);
--> statement-breakpoint
CREATE INDEX "saved_spots_spot_id_idx" ON "saved_spots" ("spot_id");
--> statement-breakpoint
CREATE INDEX "saved_spots_user_id_idx" ON "saved_spots" ("user_id");
--> statement-breakpoint
CREATE TABLE "verified_spots" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "spot_id")
);
--> statement-breakpoint
CREATE INDEX "verified_spots_spot_id_idx" ON "verified_spots" ("spot_id");
--> statement-breakpoint
CREATE INDEX "verified_spots_user_id_idx" ON "verified_spots" ("user_id");
--> statement-breakpoint
CREATE TABLE "spot_weather_verifications" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "spot_id")
);
--> statement-breakpoint
CREATE INDEX "spot_weather_verifications_spot_id_idx" ON "spot_weather_verifications" ("spot_id");
--> statement-breakpoint
CREATE INDEX "spot_weather_verifications_user_id_idx" ON "spot_weather_verifications" ("user_id");
--> statement-breakpoint
CREATE TABLE "spot_weather_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE RESTRICT,
  "user_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "temperature" integer,
  "condition" text,
  "wind_speed" integer,
  "humidity" integer,
  "status" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "spot_weather_reports_spot_id_idx" ON "spot_weather_reports" ("spot_id");
--> statement-breakpoint
CREATE INDEX "spot_weather_reports_created_at_idx" ON "spot_weather_reports" ("created_at");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "tv_videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL CHECK (length("title") > 0),
  "youtube_url" text NOT NULL CHECK (length("youtube_url") > 0),
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "categories" text[] NOT NULL DEFAULT '{}'::text[],
  "post_date" timestamptz NOT NULL,
  "published" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "tv_videos_categories_check" CHECK (cardinality("categories") >= 1 and cardinality("categories") <= 12 and array_position("categories", '') is null and array_position("categories", null) is null)
);
--> statement-breakpoint
CREATE INDEX "tv_videos_published_discipline_post_date_idx" ON "tv_videos" ("published", "discipline_slug", "post_date");
--> statement-breakpoint
CREATE INDEX "tv_videos_categories_gin_idx" ON "tv_videos" USING gin ("categories");
--> statement-breakpoint
CREATE INDEX "tv_videos_published_sort_idx" ON "tv_videos" ("published", "sort_order", "created_at");
--> statement-breakpoint
CREATE INDEX "tv_videos_discipline_idx" ON "tv_videos" ("discipline_slug");
--> statement-breakpoint
CREATE INDEX "tv_videos_published_keyset_idx" ON "tv_videos" ("sort_order" ASC, "post_date" DESC, "created_at" DESC, "id" DESC) WHERE ("published" = true);
--> statement-breakpoint
CREATE INDEX "tv_videos_published_discipline_keyset_idx" ON "tv_videos" ("discipline_slug" ASC, "sort_order" ASC, "post_date" DESC, "created_at" DESC, "id" DESC) WHERE ("published" = true);
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "sport_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "short_name" text,
  "description" text NOT NULL DEFAULT '',
  "origin" text NOT NULL DEFAULT 'community' CHECK ("origin" in ('seed','community')),
  "visibility" text NOT NULL DEFAULT 'unlisted' CHECK ("visibility" in ('public','unlisted')),
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" in ('draft','registration_open','registration_closed','scheduled','live','completed','cancelled')),
  "timezone" text NOT NULL CHECK (length("timezone") > 0),
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz,
  "registration_closes_at" timestamptz,
  "schedule_published_at" timestamptz,
  "payment_due_at" timestamptz,
  "payment_deadline_at" timestamptz,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "cancelled_at" timestamptz,
  "results_published_at" timestamptz,
  "city" text NOT NULL CHECK (length("city") > 0),
  "city_slug" text NOT NULL CHECK (length("city_slug") > 0),
  "address" text NOT NULL DEFAULT '',
  "location" geography(Point, 4326),
  "image_url" text NOT NULL CHECK (length("image_url") > 0),
  "country_code" text NOT NULL REFERENCES "countries"("iso2") ON DELETE RESTRICT,
  "category_slug" text REFERENCES "event_categories"("slug") ON DELETE SET NULL,
  "tier_slug" text REFERENCES "event_tiers"("slug") ON DELETE SET NULL,
  "plan_slug" text REFERENCES "event_plans"("slug") ON DELETE RESTRICT,
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "version" integer NOT NULL DEFAULT 0 CHECK ("version" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sport_events_end_at_after_start_at_check" CHECK ("end_at" is null or "end_at" >= "start_at")
);
--> statement-breakpoint
CREATE INDEX "sport_events_country_code_idx" ON "sport_events" ("country_code");
--> statement-breakpoint
CREATE INDEX "sport_events_city_slug_idx" ON "sport_events" ("city_slug");
--> statement-breakpoint
CREATE INDEX "sport_events_start_at_idx" ON "sport_events" ("start_at");
--> statement-breakpoint
CREATE INDEX "sport_events_location_gist_idx" ON "sport_events" USING gist ("location");
--> statement-breakpoint
CREATE INDEX "sport_events_category_idx" ON "sport_events" ("category_slug");
--> statement-breakpoint
CREATE INDEX "sport_events_tier_idx" ON "sport_events" ("tier_slug");
--> statement-breakpoint
CREATE INDEX "sport_events_plan_idx" ON "sport_events" ("plan_slug");
--> statement-breakpoint
CREATE INDEX "sport_events_created_by_idx" ON "sport_events" ("created_by");
--> statement-breakpoint
CREATE INDEX "sport_events_status_idx" ON "sport_events" ("status");
--> statement-breakpoint
CREATE INDEX "sport_events_origin_visibility_idx" ON "sport_events" ("origin", "visibility");
--> statement-breakpoint
CREATE INDEX "sport_events_payment_due_at_idx" ON "sport_events" ("payment_due_at");
--> statement-breakpoint
CREATE INDEX "sport_events_payment_deadline_at_idx" ON "sport_events" ("payment_deadline_at");
--> statement-breakpoint
CREATE INDEX "sport_events_creator_quota_idx" ON "sport_events" ("created_by", "origin", "created_at");
--> statement-breakpoint
CREATE TABLE "event_disciplines" (
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  PRIMARY KEY ("event_id", "discipline_slug")
);
--> statement-breakpoint
CREATE INDEX "event_disciplines_discipline_idx" ON "event_disciplines" ("discipline_slug");
--> statement-breakpoint
CREATE INDEX "event_disciplines_discipline_event_idx" ON "event_disciplines" ("discipline_slug", "event_id");
--> statement-breakpoint
CREATE TABLE "user_event_plans" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "plan_slug" text NOT NULL REFERENCES "event_plans"("slug") ON DELETE RESTRICT,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" in ('active','exhausted','cancelled')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "event_id")
);
--> statement-breakpoint
CREATE INDEX "user_event_plans_plan_idx" ON "user_event_plans" ("plan_slug");
--> statement-breakpoint
CREATE TABLE "event_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "payer_user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "plan_slug" text NOT NULL REFERENCES "event_plans"("slug") ON DELETE RESTRICT,
  "provider" text NOT NULL CHECK ("provider" in ('stripe','manual_grant','coupon')),
  "provider_payment_id" text,
  "amount_cents" integer NOT NULL CHECK ("amount_cents" >= 0),
  "currency" text NOT NULL CHECK (length("currency") = 3),
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" in ('pending','succeeded','failed','refunded')),
  "idempotency_key" text UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "event_payments_event_id_idx" ON "event_payments" ("event_id");
--> statement-breakpoint
CREATE INDEX "event_payments_payer_idx" ON "event_payments" ("payer_user_id");
--> statement-breakpoint
CREATE TABLE "event_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "code" text NOT NULL UNIQUE CHECK (length("code") > 0),
  "role" text NOT NULL DEFAULT 'competitor' CHECK ("role" in ('judge','staff','competitor')),
  "max_uses" integer CHECK ("max_uses" is null or "max_uses" > 0),
  "uses_count" integer NOT NULL DEFAULT 0 CHECK ("uses_count" >= 0),
  "expires_at" timestamptz,
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "event_invites_event_id_idx" ON "event_invites" ("event_id");
--> statement-breakpoint
CREATE TABLE "event_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "role" text NOT NULL CHECK ("role" in ('creator','judge','staff','competitor')),
  "discipline_slug" text REFERENCES "sport_disciplines"("slug") ON DELETE SET NULL,
  "invite_id" uuid REFERENCES "event_invites"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" in ('active','withdrawn','disqualified')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_memberships_event_user_unique" UNIQUE ("event_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX "event_memberships_user_idx" ON "event_memberships" ("user_id");
--> statement-breakpoint
CREATE INDEX "event_memberships_role_idx" ON "event_memberships" ("event_id", "role");
--> statement-breakpoint
CREATE INDEX "event_memberships_invite_replay_idx" ON "event_memberships" ("invite_id", "status");
--> statement-breakpoint
CREATE TABLE "event_scoring_criteria" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL DEFAULT '',
  "weight" numeric(4, 2) NOT NULL DEFAULT 1.00 CHECK ("weight" > 0),
  "max_score" integer NOT NULL DEFAULT 100 CHECK ("max_score" > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX "event_scoring_criteria_event_sort_idx" ON "event_scoring_criteria" ("event_id", "sort_order");
--> statement-breakpoint
CREATE TABLE "event_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "competitor_user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "round_number" integer NOT NULL DEFAULT 1 CHECK ("round_number" >= 1),
  "run_number" integer NOT NULL DEFAULT 1 CHECK ("run_number" >= 1),
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" in ('pending','live','completed','dropped')),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_runs_competitor_round_run_unique" UNIQUE ("event_id", "competitor_user_id", "round_number", "run_number")
);
--> statement-breakpoint
CREATE INDEX "event_runs_event_round_idx" ON "event_runs" ("event_id", "round_number");
--> statement-breakpoint
CREATE TABLE "event_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "event_runs"("id") ON DELETE CASCADE,
  "judge_user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "criterion_id" uuid NOT NULL REFERENCES "event_scoring_criteria"("id") ON DELETE CASCADE,
  "score" numeric(6, 2) NOT NULL CHECK ("score" >= 0),
  "notes" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_scores_run_judge_criterion_unique" UNIQUE ("run_id", "judge_user_id", "criterion_id")
);
--> statement-breakpoint
CREATE INDEX "event_scores_run_idx" ON "event_scores" ("run_id");
--> statement-breakpoint
CREATE TABLE "event_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "competitor_user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "rank" integer NOT NULL CHECK ("rank" >= 1),
  "total_score" numeric(8, 2) NOT NULL CHECK ("total_score" >= 0),
  "points_awarded" integer NOT NULL DEFAULT 0 CHECK ("points_awarded" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_results_event_competitor_discipline_unique" UNIQUE ("event_id", "competitor_user_id", "discipline_slug")
);
--> statement-breakpoint
CREATE INDEX "event_results_event_rank_idx" ON "event_results" ("event_id", "rank");
--> statement-breakpoint
CREATE TABLE "event_points_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "points" integer NOT NULL CHECK ("points" >= 0),
  "reason" text NOT NULL DEFAULT 'event_result',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "event_points_ledger_user_discipline_idx" ON "event_points_ledger" ("user_id", "discipline_slug");
--> statement-breakpoint
CREATE TABLE "event_action_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "request_fingerprint" text NOT NULL UNIQUE CHECK (length("request_fingerprint") > 0),
  "action_type" text NOT NULL CHECK (length("action_type") > 0),
  "status" text NOT NULL DEFAULT 'completed' CHECK ("status" in ('pending','completed','failed')),
  "response_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "event_action_requests_event_id_idx" ON "event_action_requests" ("event_id");
--> statement-breakpoint
CREATE TABLE "event_realtime_signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "signal_type" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "event_realtime_signals_event_created_idx" ON "event_realtime_signals" ("event_id", "created_at");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE OR REPLACE VIEW "sport_events_with_status" AS
SELECT
  se.*,
  CASE
    WHEN se.status = 'cancelled' THEN 'cancelled'
    WHEN se.status = 'completed' THEN 'completed'
    WHEN se.status = 'live' THEN 'live'
    WHEN now() < se.start_at THEN 'upcoming'
    WHEN se.end_at IS NOT NULL AND now() BETWEEN se.start_at AND se.end_at THEN 'live'
    WHEN se.end_at IS NULL AND now() >= se.start_at AND now() < se.start_at + interval '1 day' THEN 'live'
    ELSE 'completed'
  END AS derived_status
FROM "sport_events" se;
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "trick_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "source_id" text NOT NULL,
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL DEFAULT '',
  "level" integer NOT NULL CHECK ("level" BETWEEN 1 AND 5),
  "categories" jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("categories") = 'array' and jsonb_array_length("categories") <= 12),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "trick_definitions_discipline_source_id_key" UNIQUE ("discipline_slug", "source_id")
);
--> statement-breakpoint
CREATE INDEX "trick_definitions_discipline_level_idx" ON "trick_definitions" ("discipline_slug", "level");
--> statement-breakpoint
CREATE TABLE "trick_definition_spot_types" (
  "trick_id" uuid NOT NULL REFERENCES "trick_definitions"("id") ON DELETE CASCADE,
  "spot_type_slug" text NOT NULL REFERENCES "spot_types"("slug") ON DELETE RESTRICT,
  PRIMARY KEY ("trick_id", "spot_type_slug")
);
--> statement-breakpoint
CREATE INDEX "trick_def_spot_types_spot_type_idx" ON "trick_definition_spot_types" ("spot_type_slug");
--> statement-breakpoint
CREATE TABLE "trick_catalog_states" (
  "discipline_slug" text PRIMARY KEY REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "active_catalog_id" uuid,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "challenge_catalogs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "challenge_key" text NOT NULL CHECK ("challenge_key" = lower("challenge_key")),
  "game_name" text NOT NULL,
  "elimination_word" text NOT NULL CHECK ("elimination_word" = upper("elimination_word")),
  "word_length" integer NOT NULL CHECK ("word_length" = length("elimination_word")),
  "source_path" text NOT NULL,
  "source_sha256" text NOT NULL,
  "trick_count" integer NOT NULL CHECK ("trick_count" >= 1),
  "level_one_count" integer NOT NULL,
  "level_two_count" integer NOT NULL,
  "level_three_count" integer NOT NULL,
  "level_four_count" integer NOT NULL DEFAULT 0,
  "level_five_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "challenge_catalogs_discipline_sha_key" UNIQUE ("discipline_slug", "source_sha256"),
  CONSTRAINT "challenge_catalogs_counts_check" CHECK ("level_one_count" + "level_two_count" + "level_three_count" + "level_four_count" + "level_five_count" = "trick_count")
);
--> statement-breakpoint
CREATE INDEX "challenge_catalogs_discipline_created_idx" ON "challenge_catalogs" ("discipline_slug", "created_at");
--> statement-breakpoint
ALTER TABLE "trick_catalog_states" ADD CONSTRAINT "trick_catalog_states_active_catalog_id_fkey" FOREIGN KEY ("active_catalog_id") REFERENCES "challenge_catalogs"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TABLE "challenge_catalog_tricks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "catalog_id" uuid NOT NULL REFERENCES "challenge_catalogs"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL CHECK (length("source_id") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL,
  "level" integer NOT NULL CHECK ("level" BETWEEN 1 AND 5),
  "categories" jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("categories") = 'array' and jsonb_array_length("categories") <= 12),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "challenge_catalog_tricks_catalog_source_key" UNIQUE ("catalog_id", "source_id")
);
--> statement-breakpoint
CREATE INDEX "challenge_catalog_tricks_catalog_level_idx" ON "challenge_catalog_tricks" ("catalog_id", "level");
--> statement-breakpoint
CREATE TABLE "challenge_trick_spot_types" (
  "trick_id" uuid NOT NULL REFERENCES "challenge_catalog_tricks"("id") ON DELETE CASCADE,
  "spot_type_slug" text NOT NULL REFERENCES "spot_types"("slug") ON DELETE RESTRICT,
  PRIMARY KEY ("trick_id", "spot_type_slug")
);
--> statement-breakpoint
CREATE INDEX "challenge_trick_spot_types_spot_type_idx" ON "challenge_trick_spot_types" ("spot_type_slug");
--> statement-breakpoint
CREATE TABLE "spot_challenge_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "best_lap_seconds" numeric(8, 3),
  "best_lap_holder_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "best_score" integer NOT NULL DEFAULT 0,
  "best_score_holder_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "spot_challenge_records_spot_discipline_key" UNIQUE ("spot_id", "discipline_slug")
);
--> statement-breakpoint
CREATE INDEX "spot_challenge_records_discipline_idx" ON "spot_challenge_records" ("discipline_slug");
--> statement-breakpoint
CREATE TABLE "rider_stats" (
  "user_id" uuid PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "games_played" integer NOT NULL DEFAULT 0,
  "games_won" integer NOT NULL DEFAULT 0,
  "games_lost" integer NOT NULL DEFAULT 0,
  "total_attempts" integer NOT NULL DEFAULT 0,
  "successful_attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rider_score_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "score" integer NOT NULL,
  "trick_level" integer NOT NULL CHECK ("trick_level" BETWEEN 1 AND 5),
  "reason" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "rider_score_events_user_discipline_idx" ON "rider_score_events" ("user_id", "discipline_slug");
--> statement-breakpoint
CREATE TABLE "game_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spot_id" uuid REFERENCES "spots"("id") ON DELETE SET NULL,
  "spot_removed" boolean NOT NULL DEFAULT false,
  "spot_name_snapshot" text,
  "spot_city_snapshot" text,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "mode" text NOT NULL CHECK ("mode" in ('challenge','race','training')),
  "status" text NOT NULL DEFAULT 'lobby' CHECK ("status" in ('lobby','in_progress','completed','abandoned')),
  "current_round" integer NOT NULL DEFAULT 1,
  "current_turn_index" integer NOT NULL DEFAULT 0,
  "creator_user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "winner_user_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "catalog_id" uuid REFERENCES "challenge_catalogs"("id") ON DELETE RESTRICT,
  "version" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "game_sessions_spot_id_idx" ON "game_sessions" ("spot_id");
--> statement-breakpoint
CREATE INDEX "game_sessions_creator_idx" ON "game_sessions" ("creator_user_id");
--> statement-breakpoint
CREATE INDEX "game_sessions_status_idx" ON "game_sessions" ("status");
--> statement-breakpoint
CREATE TABLE "game_players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "letters" text NOT NULL DEFAULT '',
  "turn_order" integer NOT NULL,
  "is_eliminated" boolean NOT NULL DEFAULT false,
  "eliminated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_players_game_user_unique" UNIQUE ("game_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX "game_players_game_turn_idx" ON "game_players" ("game_id", "turn_order");
--> statement-breakpoint
CREATE TABLE "game_rounds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "round_number" integer NOT NULL,
  "setter_player_id" uuid NOT NULL REFERENCES "game_players"("id") ON DELETE CASCADE,
  "trick_id" uuid REFERENCES "challenge_catalog_tricks"("id") ON DELETE RESTRICT,
  "trick_name" text NOT NULL,
  "trick_level" integer NOT NULL CHECK ("trick_level" BETWEEN 1 AND 5),
  "set_successful" boolean,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_rounds_game_round_number_unique" UNIQUE ("game_id", "round_number")
);
--> statement-breakpoint
CREATE INDEX "game_rounds_game_id_idx" ON "game_rounds" ("game_id");
--> statement-breakpoint
CREATE TABLE "game_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "round_id" uuid NOT NULL REFERENCES "game_rounds"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "game_players"("id") ON DELETE CASCADE,
  "successful" boolean NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_attempts_round_player_unique" UNIQUE ("round_id", "player_id")
);
--> statement-breakpoint
CREATE INDEX "game_attempts_round_id_idx" ON "game_attempts" ("round_id");
--> statement-breakpoint
CREATE TABLE "game_action_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "request_fingerprint" text NOT NULL UNIQUE CHECK (length("request_fingerprint") > 0),
  "action_type" text NOT NULL,
  "response_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "game_action_requests_game_id_idx" ON "game_action_requests" ("game_id");
--> statement-breakpoint
CREATE TABLE "game_location_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "game_players"("id") ON DELETE CASCADE,
  "distance_meters" numeric(8, 2) NOT NULL,
  "verified" boolean NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "game_location_verifications_game_id_idx" ON "game_location_verifications" ("game_id");
--> statement-breakpoint
CREATE TABLE "game_race_laps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "game_players"("id") ON DELETE CASCADE,
  "lap_number" integer NOT NULL CHECK ("lap_number" >= 1),
  "lap_time_seconds" numeric(8, 3) NOT NULL CHECK ("lap_time_seconds" > 0),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "game_race_laps_game_player_idx" ON "game_race_laps" ("game_id", "player_id");
--> statement-breakpoint
CREATE TABLE "game_realtime_signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "signal_type" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "game_realtime_signals_game_created_idx" ON "game_realtime_signals" ("game_id", "created_at");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "permission_id")
);
--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" ("permission_id");
--> statement-breakpoint
CREATE TABLE "user_roles" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "granted_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "role_id")
);
--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" ("role_id");
--> statement-breakpoint
CREATE TABLE "curator_country_scopes" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "country_code" text NOT NULL REFERENCES "countries"("iso2") ON DELETE CASCADE,
  "granted_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "country_code")
);
--> statement-breakpoint
CREATE INDEX "curator_country_scopes_country_idx" ON "curator_country_scopes" ("country_code");
--> statement-breakpoint
CREATE TABLE "curator_discipline_scopes" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE CASCADE,
  "granted_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "discipline_slug")
);
--> statement-breakpoint
CREATE INDEX "curator_discipline_scopes_discipline_idx" ON "curator_discipline_scopes" ("discipline_slug");
--> statement-breakpoint
CREATE TABLE "content_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "entity_type" text NOT NULL CHECK ("entity_type" in ('spot','event','trick','tv_video')),
  "entity_id" uuid NOT NULL,
  "discipline_slug" text REFERENCES "sport_disciplines"("slug") ON DELETE SET NULL,
  "action" text NOT NULL CHECK ("action" in ('create','update','delete')),
  "before" jsonb,
  "after" jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "content_audit_log_entity_idx" ON "content_audit_log" ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX "content_audit_log_actor_idx" ON "content_audit_log" ("actor_id");
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "target_user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "action" text NOT NULL CHECK ("action" in ('replace_roles','replace_country_scopes','replace_discipline_scopes')),
  "before" jsonb NOT NULL,
  "after" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_idx" ON "admin_audit_log" ("actor_id");
--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_idx" ON "admin_audit_log" ("target_user_id");
--> statement-breakpoint
CREATE TABLE "user_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "event_id" uuid REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "read_at" timestamptz,
  "emailed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "user_notifications_user_unread_idx" ON "user_notifications" ("user_id", "read_at", "created_at");
--> statement-breakpoint
CREATE INDEX "user_notifications_emailed_at_idx" ON "user_notifications" ("user_id", "emailed_at");
--> statement-breakpoint
CREATE TABLE "user_email_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "email_digests_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "league_email_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "event_id" uuid REFERENCES "sport_events"("id") ON DELETE SET NULL,
  "kind" text NOT NULL,
  "provider_message_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "league_email_log_user_kind_idx" ON "league_email_log" ("user_id", "kind");
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.bump_verification_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.spots
    SET verification_count = verification_count + 1,
        updated_at = now()
    WHERE id = NEW.spot_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.spots
    SET verification_count = GREATEST(verification_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.spot_id;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "verified_spots_count_sync"
AFTER INSERT OR DELETE ON "verified_spots"
FOR EACH ROW
EXECUTE FUNCTION public.bump_verification_count();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_spot_discipline_presence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.spot_disciplines WHERE spot_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Spot % must have at least one assigned discipline', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER spots_require_discipline
AFTER INSERT OR UPDATE ON "spots"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_spot_discipline_presence();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_event_discipline_presence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.event_disciplines WHERE event_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Event % must have at least one assigned discipline', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER events_require_discipline
AFTER INSERT OR UPDATE ON "sport_events"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_event_discipline_presence();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_game_player_letters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_elimination_word text;
BEGIN
  SELECT cc.elimination_word INTO v_elimination_word
  FROM public.game_sessions gs
  JOIN public.challenge_catalogs cc ON cc.id = gs.catalog_id
  WHERE gs.id = NEW.game_id;

  IF v_elimination_word IS NOT NULL AND length(NEW.letters) >= length(v_elimination_word) THEN
    NEW.is_eliminated := true;
    IF NEW.eliminated_at IS NULL THEN
      NEW.eliminated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "game_players_letters_trigger"
BEFORE INSERT OR UPDATE OF "letters" ON "game_players"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_game_player_letters();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.emit_game_realtime_signal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.game_realtime_signals (game_id, signal_type, payload)
  VALUES (NEW.id, 'session_updated', jsonb_build_object('status', NEW.status, 'current_round', NEW.current_round));
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "game_sessions_realtime_signal_trigger"
AFTER UPDATE ON "game_sessions"
FOR EACH ROW
EXECUTE FUNCTION public.emit_game_realtime_signal();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reject_immutable_catalog_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Challenge catalogs and their tricks are immutable once seeded';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "challenge_catalogs_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_catalogs"
FOR EACH ROW
EXECUTE FUNCTION public.reject_immutable_catalog_mutation();
--> statement-breakpoint
CREATE TRIGGER "challenge_catalog_tricks_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_catalog_tricks"
FOR EACH ROW
EXECUTE FUNCTION public.reject_immutable_catalog_mutation();
--> statement-breakpoint
CREATE TRIGGER "challenge_trick_spot_types_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_trick_spot_types"
FOR EACH ROW
EXECUTE FUNCTION public.reject_immutable_catalog_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log rows cannot be updated or deleted';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "content_audit_immutable"
BEFORE UPDATE OR DELETE ON "content_audit_log"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER "admin_audit_immutable"
BEFORE UPDATE OR DELETE ON "admin_audit_log"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.league_escape_html(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(replace(replace(replace(replace(coalesce(raw, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.league_email_delivery_available()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets'
  );
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_slug text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id AND p.slug = p_permission_slug
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.has_country_scope(p_country_code text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.curator_country_scopes
    WHERE user_id = p_user_id AND country_code = p_country_code
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.has_discipline_scope(p_discipline_slug text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.curator_discipline_scopes
    WHERE user_id = p_user_id AND discipline_slug = p_discipline_slug
  );
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spatial_ref_sys'
  ) THEN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spatial_ref_sys' AND policyname = 'spatial_ref_sys_public_read'
    ) THEN
      EXECUTE 'CREATE POLICY "spatial_ref_sys_public_read" ON public.spatial_ref_sys FOR SELECT USING (true)';
    END IF;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "spots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spots' AND policyname = 'spots_public_read'
  ) THEN
    CREATE POLICY "spots_public_read" ON "spots" FOR SELECT USING (
      admin_hidden = false AND (visibility = 'public' OR created_by = auth.uid())
    );
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "sport_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sport_events' AND policyname = 'sport_events_public_read'
  ) THEN
    CREATE POLICY "sport_events_public_read" ON "sport_events" FOR SELECT USING (
      visibility = 'public' OR created_by = auth.uid()
    );
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_notifications' AND policyname = 'user_notifications_owner'
  ) THEN
    CREATE POLICY "user_notifications_owner" ON "user_notifications" FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_email_preferences' AND policyname = 'user_email_preferences_owner'
  ) THEN
    CREATE POLICY "user_email_preferences_owner" ON "user_email_preferences" FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "user_notifications", "game_realtime_signals", "event_realtime_signals";
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;