CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.jsonb_is_unique_uuid_array(input jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  item jsonb;
  normalized text;
  seen text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(input) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(input) AS elements(value) LOOP
    IF jsonb_typeof(item) <> 'string' THEN RETURN false; END IF;
    normalized := lower(item #>> '{}');
    IF normalized !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR normalized = ANY(seen) THEN RETURN false; END IF;
    seen := array_append(seen, normalized);
  END LOOP;
  RETURN true;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.jsonb_is_unique_nonempty_text_array(input jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  item jsonb;
  value text;
  seen text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(input) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT elements.value FROM jsonb_array_elements(input) AS elements(value) LOOP
    IF jsonb_typeof(item) <> 'string' THEN RETURN false; END IF;
    value := item #>> '{}';
    IF value = '' OR value = ANY(seen) THEN RETURN false; END IF;
    seen := array_append(seen, value);
  END LOOP;
  RETURN true;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.jsonb_is_spot_type_snapshot_array(input jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  item jsonb;
  slug text;
  seen text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(input) <> 'array' OR jsonb_array_length(input) = 0 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(input) AS elements(value) LOOP
    IF jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item -> 'slug') <> 'string'
       OR jsonb_typeof(item -> 'name') <> 'string'
       OR jsonb_typeof(item -> 'sortOrder') <> 'number'
       OR item ->> 'slug' = ''
       OR item ->> 'name' = ''
       OR item ->> 'sortOrder' !~ '^-?[0-9]+$' THEN RETURN false; END IF;
    slug := lower(item ->> 'slug');
    IF slug = ANY(seen) THEN RETURN false; END IF;
    seen := array_append(seen, slug);
  END LOOP;
  RETURN true;
END;
$$;
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_log_action_check" CHECK ("admin_audit_log"."action" in ('replace_roles','replace_country_scopes','replace_discipline_scopes'))
);
--> statement-breakpoint
CREATE TABLE "challenge_catalog_tricks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"level" integer NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_catalog_tricks_catalog_source_unique" UNIQUE("catalog_id","source_id"),
	CONSTRAINT "challenge_catalog_tricks_source_id_check" CHECK (char_length("challenge_catalog_tricks"."source_id") > 0),
	CONSTRAINT "challenge_catalog_tricks_name_check" CHECK (char_length("challenge_catalog_tricks"."name") > 0),
	CONSTRAINT "challenge_catalog_tricks_description_check" CHECK (char_length("challenge_catalog_tricks"."description") > 0),
	CONSTRAINT "challenge_catalog_tricks_level_check" CHECK ("challenge_catalog_tricks"."level" between 1 and 5),
	CONSTRAINT "challenge_catalog_tricks_categories_check" CHECK (jsonb_typeof("challenge_catalog_tricks"."categories") = 'array' and jsonb_array_length("challenge_catalog_tricks"."categories") <= 12)
);
--> statement-breakpoint
CREATE TABLE "challenge_catalogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discipline_slug" text NOT NULL,
	"challenge_key" text NOT NULL,
	"game_name" text NOT NULL,
	"elimination_word" text NOT NULL,
	"word_length" integer NOT NULL,
	"source_path" text NOT NULL,
	"source_sha256" text NOT NULL,
	"trick_count" integer NOT NULL,
	"level_one_count" integer NOT NULL,
	"level_two_count" integer NOT NULL,
	"level_three_count" integer NOT NULL,
	"level_four_count" integer DEFAULT 0 NOT NULL,
	"level_five_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_catalogs_discipline_sha_unique" UNIQUE("discipline_slug","source_sha256"),
	CONSTRAINT "challenge_catalogs_challenge_key_lower_check" CHECK ("challenge_catalogs"."challenge_key" = lower("challenge_catalogs"."challenge_key")),
	CONSTRAINT "challenge_catalogs_elimination_word_upper_check" CHECK ("challenge_catalogs"."elimination_word" = upper("challenge_catalogs"."elimination_word")),
	CONSTRAINT "challenge_catalogs_word_length_check" CHECK ("challenge_catalogs"."word_length" = char_length("challenge_catalogs"."elimination_word")),
	CONSTRAINT "challenge_catalogs_discipline_slug_check" CHECK ("challenge_catalogs"."discipline_slug" in ('roller', 'skateboard', 'bmx', 'scooter')),
	CONSTRAINT "challenge_catalogs_challenge_key_check" CHECK ("challenge_catalogs"."challenge_key" in ('blade', 'skate', 'bike', 'scoot')),
	CONSTRAINT "challenge_catalogs_definition_consistency_check" CHECK ((
      ("challenge_catalogs"."discipline_slug" = 'roller' and "challenge_catalogs"."challenge_key" = 'blade' and "challenge_catalogs"."game_name" = 'Play a Blade' and "challenge_catalogs"."elimination_word" = 'BLADE' and "challenge_catalogs"."word_length" = 5) or
      ("challenge_catalogs"."discipline_slug" = 'skateboard' and "challenge_catalogs"."challenge_key" = 'skate' and "challenge_catalogs"."game_name" = 'Play a Skate' and "challenge_catalogs"."elimination_word" = 'SKATE' and "challenge_catalogs"."word_length" = 5) or
      ("challenge_catalogs"."discipline_slug" = 'bmx' and "challenge_catalogs"."challenge_key" = 'bike' and "challenge_catalogs"."game_name" = 'Play a Bike' and "challenge_catalogs"."elimination_word" = 'BIKE' and "challenge_catalogs"."word_length" = 4) or
      ("challenge_catalogs"."discipline_slug" = 'scooter' and "challenge_catalogs"."challenge_key" = 'scoot' and "challenge_catalogs"."game_name" = 'Play a Scoot' and "challenge_catalogs"."elimination_word" = 'SCOOT' and "challenge_catalogs"."word_length" = 5)
    )),
	CONSTRAINT "challenge_catalogs_counts_check" CHECK ("challenge_catalogs"."trick_count" >= 1 and "challenge_catalogs"."level_one_count" + "challenge_catalogs"."level_two_count" + "challenge_catalogs"."level_three_count" + "challenge_catalogs"."level_four_count" + "challenge_catalogs"."level_five_count" = "challenge_catalogs"."trick_count")
);
--> statement-breakpoint
CREATE TABLE "challenge_trick_spot_types" (
	"trick_id" uuid NOT NULL,
	"spot_type_slug" text NOT NULL,
	CONSTRAINT "challenge_trick_spot_types_trick_id_spot_type_slug_pk" PRIMARY KEY("trick_id","spot_type_slug")
);
--> statement-breakpoint
CREATE TABLE "community_spot_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_spot_id" uuid,
	"location" geography(Point, 4326) NOT NULL,
	"submission_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_submissions_user_hash_unique" UNIQUE("user_id","submission_hash"),
	CONSTRAINT "community_submissions_hash_check" CHECK (length("community_spot_submissions"."submission_hash") > 0)
);
--> statement-breakpoint
CREATE TABLE "content_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"discipline_slug" text,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_audit_log_entity_type_check" CHECK ("content_audit_log"."entity_type" in ('spot', 'event', 'trick', 'tv_video')),
	CONSTRAINT "content_audit_log_action_check" CHECK ("content_audit_log"."action" in ('create', 'update', 'delete')),
	CONSTRAINT "content_audit_log_before_after_check" CHECK ((
        ("content_audit_log"."action" = 'create' and "content_audit_log"."before" is null and "content_audit_log"."after" is not null) or
        ("content_audit_log"."action" = 'update' and "content_audit_log"."before" is not null and "content_audit_log"."after" is not null) or
        ("content_audit_log"."action" = 'delete' and "content_audit_log"."before" is not null and "content_audit_log"."after" is null)
      ))
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"iso2" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"iso3" text,
	"region_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "countries_name_key" UNIQUE("name"),
	CONSTRAINT "countries_iso2_check" CHECK ("countries"."iso2" ~ '^[A-Z]{2}$'),
	CONSTRAINT "countries_iso3_check" CHECK ("countries"."iso3" is null or "countries"."iso3" ~ '^[A-Z]{3}$'),
	CONSTRAINT "countries_name_check" CHECK (length("countries"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "curator_country_scopes" (
	"user_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curator_country_scopes_user_id_country_code_pk" PRIMARY KEY("user_id","country_code"),
	CONSTRAINT "curator_country_scopes_code_check" CHECK ("curator_country_scopes"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "curator_discipline_scopes" (
	"user_id" uuid NOT NULL,
	"discipline_slug" text NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curator_discipline_scopes_user_id_discipline_slug_pk" PRIMARY KEY("user_id","discipline_slug"),
	CONSTRAINT "curator_discipline_scopes_slug_check" CHECK (length("curator_discipline_scopes"."discipline_slug") > 0)
);
--> statement-breakpoint
CREATE TABLE "event_action_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"resulting_version" integer NOT NULL,
	"response_metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_action_requests_scope_unique" UNIQUE("event_id","user_id","action","idempotency_key"),
	CONSTRAINT "event_action_requests_version_check" CHECK ("event_action_requests"."resulting_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_categories" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_categories_name_check" CHECK (length("event_categories"."name") > 0),
	CONSTRAINT "event_categories_sort_order_check" CHECK ("event_categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_disciplines" (
	"event_id" uuid NOT NULL,
	"discipline_slug" text NOT NULL,
	CONSTRAINT "event_disciplines_event_id_discipline_slug_pk" PRIMARY KEY("event_id","discipline_slug")
);
--> statement-breakpoint
CREATE TABLE "event_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"role" text NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_invites_code_key" UNIQUE("code"),
	CONSTRAINT "event_invites_role_check" CHECK ("event_invites"."role" in ('organizer','judge','rider')),
	CONSTRAINT "event_invites_code_check" CHECK (length("event_invites"."code") > 0),
	CONSTRAINT "event_invites_use_count_check" CHECK ("event_invites"."use_count" >= 0),
	CONSTRAINT "event_invites_max_uses_check" CHECK ("event_invites"."max_uses" is null or "event_invites"."max_uses" > 0),
	CONSTRAINT "event_invites_use_count_within_max_check" CHECK ("event_invites"."max_uses" is null or "event_invites"."use_count" <= "event_invites"."max_uses")
);
--> statement-breakpoint
CREATE TABLE "event_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_via_invite_id" uuid,
	"added_by" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	CONSTRAINT "event_memberships_role_check" CHECK ("event_memberships"."role" in ('main_organizer','organizer','judge','rider')),
	CONSTRAINT "event_memberships_status_check" CHECK ("event_memberships"."status" in ('active','removed','withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "event_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"plan_slug" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_reference" text,
	"payer_user_id" uuid,
	"marked_paid_by" uuid,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_payments_status_check" CHECK ("event_payments"."status" in ('pending','paid','refunded','comped','failed')),
	CONSTRAINT "event_payments_amount_check" CHECK ("event_payments"."amount_cents" >= 0),
	CONSTRAINT "event_payments_currency_check" CHECK ("event_payments"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "event_payments_provider_check" CHECK (length("event_payments"."provider") > 0)
);
--> statement-breakpoint
CREATE TABLE "event_plans" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"max_riders" integer NOT NULL,
	"max_judges" integer NOT NULL,
	"max_organizers" integer NOT NULL,
	"monthly_event_limit" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_plans_price_check" CHECK ("event_plans"."price_cents" >= 0),
	CONSTRAINT "event_plans_currency_check" CHECK ("event_plans"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "event_plans_max_riders_check" CHECK ("event_plans"."max_riders" > 0),
	CONSTRAINT "event_plans_max_judges_check" CHECK ("event_plans"."max_judges" >= 0),
	CONSTRAINT "event_plans_max_organizers_check" CHECK ("event_plans"."max_organizers" >= 1),
	CONSTRAINT "event_plans_monthly_limit_check" CHECK ("event_plans"."monthly_event_limit" > 0),
	CONSTRAINT "event_plans_name_check" CHECK (length("event_plans"."name") > 0),
	CONSTRAINT "event_plans_sort_order_check" CHECK ("event_plans"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"points" integer NOT NULL,
	"rank" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_points_ledger_event_key_key" UNIQUE("event_key"),
	CONSTRAINT "event_points_ledger_event_type_check" CHECK ("event_points_ledger"."event_type" in ('event_attended','event_rank_bonus')),
	CONSTRAINT "event_points_ledger_points_check" CHECK ("event_points_ledger"."points" >= 0),
	CONSTRAINT "event_points_ledger_event_key_check" CHECK (length("event_points_ledger"."event_key") > 0)
);
--> statement-breakpoint
CREATE TABLE "event_realtime_signals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_realtime_signals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"signal_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_realtime_signals_event_version_unique" UNIQUE("event_id","version"),
	CONSTRAINT "event_realtime_signals_version_check" CHECK ("event_realtime_signals"."version" >= 0),
	CONSTRAINT "event_realtime_signals_type_check" CHECK ("event_realtime_signals"."signal_type" in ('event_state_changed','registration_changed','schedule_published','run_started','score_submitted','results_published','event_cancelled'))
);
--> statement-breakpoint
CREATE TABLE "event_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"run_id" uuid,
	"total_score" numeric(8, 2) NOT NULL,
	"rank" integer NOT NULL,
	"points_awarded" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_results_event_user_unique" UNIQUE("event_id","user_id"),
	CONSTRAINT "event_results_event_rank_unique" UNIQUE("event_id","rank"),
	CONSTRAINT "event_results_total_check" CHECK ("event_results"."total_score" >= 0),
	CONSTRAINT "event_results_rank_check" CHECK ("event_results"."rank" > 0),
	CONSTRAINT "event_results_points_check" CHECK ("event_results"."points_awarded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" text DEFAULT 'final' NOT NULL,
	"sequence" integer NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"window_started_at" timestamp with time zone,
	"window_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_runs_event_membership_stage_unique" UNIQUE("event_id","membership_id","stage"),
	CONSTRAINT "event_runs_event_stage_sequence_unique" UNIQUE("event_id","stage","sequence"),
	CONSTRAINT "event_runs_stage_check" CHECK (length("event_runs"."stage") > 0),
	CONSTRAINT "event_runs_sequence_check" CHECK ("event_runs"."sequence" > 0),
	CONSTRAINT "event_runs_status_check" CHECK ("event_runs"."status" in ('scheduled','judging','scored','skipped','completed')),
	CONSTRAINT "event_runs_window_after_start_check" CHECK ("event_runs"."window_ends_at" is null or ("event_runs"."window_started_at" is not null and "event_runs"."window_ends_at" > "event_runs"."window_started_at"))
);
--> statement-breakpoint
CREATE TABLE "event_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"judge_user_id" uuid NOT NULL,
	"scores" jsonb NOT NULL,
	"total" numeric(8, 2) NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_scores_run_judge_unique" UNIQUE("run_id","judge_user_id"),
	CONSTRAINT "event_scores_scores_shape_check" CHECK (jsonb_typeof("event_scores"."scores") = 'object'),
	CONSTRAINT "event_scores_total_check" CHECK ("event_scores"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_scoring_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"weight" numeric(6, 3) DEFAULT '1' NOT NULL,
	"max_score" numeric(6, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_scoring_criteria_event_key_unique" UNIQUE("event_id","key"),
	CONSTRAINT "event_scoring_criteria_key_check" CHECK ("event_scoring_criteria"."key" = lower("event_scoring_criteria"."key") and length("event_scoring_criteria"."key") > 0),
	CONSTRAINT "event_scoring_criteria_label_check" CHECK (length("event_scoring_criteria"."label") > 0),
	CONSTRAINT "event_scoring_criteria_weight_check" CHECK ("event_scoring_criteria"."weight" > 0),
	CONSTRAINT "event_scoring_criteria_max_score_check" CHECK ("event_scoring_criteria"."max_score" > 0),
	CONSTRAINT "event_scoring_criteria_sort_order_check" CHECK ("event_scoring_criteria"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_action_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_token" text,
	"action" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"resulting_version" integer NOT NULL,
	"response_metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_action_requests_identity_check" CHECK (("game_action_requests"."user_id" is null) <> ("game_action_requests"."guest_token" is null))
);
--> statement-breakpoint
CREATE TABLE "game_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"result" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_attempts_round_player_unique" UNIQUE("round_id","player_id"),
	CONSTRAINT "game_attempts_result_check" CHECK ("game_attempts"."result" in ('landed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "game_location_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"spot_id" uuid NOT NULL,
	"verified_at" timestamp with time zone,
	"distance_meters" integer,
	"accuracy_meters" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"expires_at" timestamp with time zone,
	CONSTRAINT "game_location_verifications_round_player_unique" UNIQUE("round_id","player_id"),
	CONSTRAINT "game_location_verifications_status_check" CHECK ("game_location_verifications"."status" in ('pending', 'verified', 'rejected', 'expired', 'unavailable')),
	CONSTRAINT "game_location_verifications_rejection_reason_check" CHECK ("game_location_verifications"."rejection_reason" is null or "game_location_verifications"."rejection_reason" in ('too_far', 'low_accuracy', 'denied', 'unavailable'))
);
--> statement-breakpoint
CREATE TABLE "game_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_token" text,
	"display_name" text NOT NULL,
	"seat_order" integer NOT NULL,
	"letters" text DEFAULT '' NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_players_game_seat_unique" UNIQUE("game_id","seat_order"),
	CONSTRAINT "game_players_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "game_players_status_check" CHECK ("game_players"."status" in ('active', 'eliminated', 'left')),
	CONSTRAINT "game_players_display_name_check" CHECK (char_length("game_players"."display_name") between 1 and 30),
	CONSTRAINT "game_players_seat_order_check" CHECK ("game_players"."seat_order" >= 0),
	CONSTRAINT "game_players_identity_check" CHECK (("game_players"."user_id" is null) <> ("game_players"."guest_token" is null)),
	CONSTRAINT "game_players_failed_attempts_check" CHECK ("game_players"."failed_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_race_laps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"lap_number" integer NOT NULL,
	"milliseconds" integer NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_race_laps_game_player_lap_unique" UNIQUE("game_id","player_id","lap_number"),
	CONSTRAINT "game_race_laps_lap_number_check" CHECK ("game_race_laps"."lap_number" between 1 and 20),
	CONSTRAINT "game_race_laps_milliseconds_check" CHECK ("game_race_laps"."milliseconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "game_realtime_signals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_realtime_signals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"game_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"signal_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_realtime_signals_game_version_unique" UNIQUE("game_id","version"),
	CONSTRAINT "game_realtime_signals_version_check" CHECK ("game_realtime_signals"."version" >= 0),
	CONSTRAINT "game_realtime_signals_type_check" CHECK ("game_realtime_signals"."signal_type" in ('game_state_changed', 'game_completed', 'game_cancelled'))
);
--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"challenger_player_id" uuid,
	"trick_id" text,
	"trick_name_snapshot" text,
	"trick_description_snapshot" text,
	"trick_level" integer,
	"level_selected_by_player_id" uuid,
	"spot_type" text NOT NULL,
	"spot_type_changed" boolean DEFAULT false NOT NULL,
	"spot_type_changed_by_player_id" uuid,
	"spot_type_snapshot" jsonb NOT NULL,
	"trick_compatibility_snapshot" jsonb,
	"eligible_player_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"catalog_trick_id" uuid,
	"trick_source_id" text,
	"trick_discipline_snapshot" text,
	"blocked_reason" text,
	"challenger_result" text DEFAULT 'pending' NOT NULL,
	"challenge_outcome" text,
	"lead_retained" boolean DEFAULT false NOT NULL,
	"challenger_attempted_at" timestamp with time zone,
	"status" text DEFAULT 'verifying_location' NOT NULL,
	"required_response_player_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "game_rounds_game_sequence_unique" UNIQUE("game_id","sequence"),
	CONSTRAINT "game_rounds_game_id_id_unique" UNIQUE("game_id","id"),
	CONSTRAINT "game_rounds_level_check" CHECK ("game_rounds"."trick_level" is null or "game_rounds"."trick_level" between 1 and 5),
	CONSTRAINT "game_rounds_sequence_check" CHECK ("game_rounds"."sequence" > 0),
	CONSTRAINT "game_rounds_challenge_outcome_check" CHECK ("game_rounds"."challenge_outcome" is null or "game_rounds"."challenge_outcome" in ('established', 'failed_to_establish', 'resolved')),
	CONSTRAINT "game_rounds_challenger_result_check" CHECK ("game_rounds"."challenger_result" in ('pending', 'landed', 'failed')),
	CONSTRAINT "game_rounds_status_check" CHECK ("game_rounds"."status" in ('verifying_location', 'selecting_spot_type', 'selecting_level', 'no_compatible_trick', 'challenge_open', 'collecting_results', 'resolved', 'paused', 'cancelled')),
	CONSTRAINT "game_rounds_trick_discipline_check" CHECK ("game_rounds"."trick_discipline_snapshot" is null or "game_rounds"."trick_discipline_snapshot" in ('roller', 'skateboard', 'bmx', 'scooter')),
	CONSTRAINT "game_rounds_spot_type_snapshot_shape_check" CHECK (jsonb_is_spot_type_snapshot_array("game_rounds"."spot_type_snapshot")),
	CONSTRAINT "game_rounds_trick_compatibility_shape_check" CHECK ("game_rounds"."trick_compatibility_snapshot" is null or jsonb_is_unique_nonempty_text_array("game_rounds"."trick_compatibility_snapshot")),
	CONSTRAINT "game_rounds_eligible_player_ids_shape_check" CHECK (jsonb_is_unique_uuid_array("game_rounds"."eligible_player_ids")),
	CONSTRAINT "game_rounds_required_response_player_ids_shape_check" CHECK (jsonb_is_unique_uuid_array("game_rounds"."required_response_player_ids"))
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_code" text NOT NULL,
	"mode" text NOT NULL,
	"rule_mode" text DEFAULT 'flexible' NOT NULL,
	"game_format" text DEFAULT 'tricks' NOT NULL,
	"training_variant" text DEFAULT 'multiplayer' NOT NULL,
	"lap_count" integer,
	"ghost_mode" text DEFAULT 'off' NOT NULL,
	"discipline_slug" text NOT NULL,
	"challenge_key" text NOT NULL,
	"game_name" text NOT NULL,
	"elimination_word" text NOT NULL,
	"word_length" integer NOT NULL,
	"catalog_id" uuid NOT NULL,
	"spot_id" uuid,
	"spot_removed" boolean DEFAULT false NOT NULL,
	"spot_name_snapshot" text,
	"spot_city_snapshot" text,
	"scheduled_start_at" timestamp with time zone,
	"timezone" text,
	"location_radius_meters" integer,
	"location_max_accuracy_meters" integer,
	"location_verification_ttl_seconds" integer,
	"weather_forecast_icon" text,
	"weather_forecast_description" text,
	"weather_forecast_temp" integer,
	"weather_observed_icon" text,
	"weather_confirmed" boolean,
	"weather_reported_at" timestamp with time zone,
	"weather_forecast_snapshot" jsonb,
	"available_spot_types" jsonb NOT NULL,
	"initial_spot_type" text NOT NULL,
	"next_spot_type" text NOT NULL,
	"next_level" integer,
	"selected_categories" jsonb,
	"pending_categories" jsonb,
	"pending_proposer_player_id" uuid,
	"pending_votes" jsonb,
	"pending_proposal_created_at" timestamp with time zone,
	"status" text DEFAULT 'lobby' NOT NULL,
	"created_by" uuid,
	"creator_ip_hash" text NOT NULL,
	"creator_display_name" text NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"winner_player_id" uuid,
	"current_round_id" uuid,
	"current_challenger_player_id" uuid,
	"rotation_order" jsonb NOT NULL,
	"rotation_index" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_sessions_share_code_key" UNIQUE("share_code"),
	CONSTRAINT "game_sessions_status_check" CHECK ("game_sessions"."status" in ('lobby', 'active', 'complete', 'cancelled')),
	CONSTRAINT "game_sessions_mode_check" CHECK ("game_sessions"."mode" in ('challenge', 'training')),
	CONSTRAINT "game_sessions_rule_mode_check" CHECK ("game_sessions"."rule_mode" in ('strict', 'flexible')),
	CONSTRAINT "game_sessions_game_format_check" CHECK ("game_sessions"."game_format" in ('tricks', 'bmx_track_racing')),
	CONSTRAINT "game_sessions_training_variant_check" CHECK ("game_sessions"."training_variant" in ('multiplayer', 'solo')),
	CONSTRAINT "game_sessions_solo_variant_check" CHECK ("game_sessions"."training_variant" <> 'solo' or ("game_sessions"."mode" = 'training' and "game_sessions"."game_format" = 'tricks')),
	CONSTRAINT "game_sessions_ghost_mode_check" CHECK ("game_sessions"."ghost_mode" in ('off', 'global_best')),
	CONSTRAINT "game_sessions_racing_settings_check" CHECK ("game_sessions"."game_format" <> 'bmx_track_racing' or ("game_sessions"."discipline_slug" = 'bmx' and "game_sessions"."lap_count" between 1 and 20 and "game_sessions"."ghost_mode" = 'global_best')),
	CONSTRAINT "game_sessions_discipline_slug_check" CHECK ("game_sessions"."discipline_slug" in ('roller', 'skateboard', 'bmx', 'scooter')),
	CONSTRAINT "game_sessions_challenge_key_check" CHECK ("game_sessions"."challenge_key" in ('blade', 'skate', 'bike', 'scoot')),
	CONSTRAINT "game_sessions_elimination_word_check" CHECK ("game_sessions"."elimination_word" = upper("game_sessions"."elimination_word")),
	CONSTRAINT "game_sessions_check" CHECK ("game_sessions"."word_length" = char_length("game_sessions"."elimination_word")),
	CONSTRAINT "game_sessions_definition_consistency_check" CHECK ((
      ("game_sessions"."discipline_slug" = 'roller' and "game_sessions"."challenge_key" = 'blade' and "game_sessions"."game_name" = 'Play a Blade' and "game_sessions"."elimination_word" = 'BLADE' and "game_sessions"."word_length" = 5) or
      ("game_sessions"."discipline_slug" = 'skateboard' and "game_sessions"."challenge_key" = 'skate' and "game_sessions"."game_name" = 'Play a Skate' and "game_sessions"."elimination_word" = 'SKATE' and "game_sessions"."word_length" = 5) or
      ("game_sessions"."discipline_slug" = 'bmx' and "game_sessions"."challenge_key" = 'bike' and "game_sessions"."game_name" = 'Play a Bike' and "game_sessions"."elimination_word" = 'BIKE' and "game_sessions"."word_length" = 4) or
      ("game_sessions"."discipline_slug" = 'scooter' and "game_sessions"."challenge_key" = 'scoot' and "game_sessions"."game_name" = 'Play a Scoot' and "game_sessions"."elimination_word" = 'SCOOT' and "game_sessions"."word_length" = 5)
    )),
	CONSTRAINT "game_sessions_next_level_check" CHECK ("game_sessions"."next_level" is null or "game_sessions"."next_level" between 1 and 5),
	CONSTRAINT "game_sessions_version_check" CHECK ("game_sessions"."version" >= 0),
	CONSTRAINT "game_sessions_rotation_index_check" CHECK ("game_sessions"."rotation_index" >= 0),
	CONSTRAINT "game_sessions_snapshot_nonempty_check" CHECK (jsonb_typeof("game_sessions"."available_spot_types") = 'array' and jsonb_array_length("game_sessions"."available_spot_types") > 0),
	CONSTRAINT "game_sessions_available_spot_types_shape_check" CHECK (jsonb_is_spot_type_snapshot_array("game_sessions"."available_spot_types")),
	CONSTRAINT "game_sessions_rotation_order_shape_check" CHECK (jsonb_is_unique_uuid_array("game_sessions"."rotation_order")),
	CONSTRAINT "game_sessions_initial_spot_type_snapshot_check" CHECK ("game_sessions"."available_spot_types" @> jsonb_build_array(jsonb_build_object('slug', "game_sessions"."initial_spot_type"))),
	CONSTRAINT "game_sessions_next_spot_type_snapshot_check" CHECK ("game_sessions"."available_spot_types" @> jsonb_build_array(jsonb_build_object('slug', "game_sessions"."next_spot_type"))),
	CONSTRAINT "game_sessions_challenge_requires_spot_check" CHECK (("game_sessions"."mode" <> 'challenge' or (("game_sessions"."spot_id" is not null and "game_sessions"."scheduled_start_at" is not null and "game_sessions"."timezone" is not null and "game_sessions"."location_radius_meters" is not null and "game_sessions"."location_max_accuracy_meters" is not null and "game_sessions"."location_verification_ttl_seconds" is not null and "game_sessions"."created_by" is not null) or ("game_sessions"."spot_id" is null and "game_sessions"."spot_removed")))),
	CONSTRAINT "game_sessions_training_forbids_spot_check" CHECK ("game_sessions"."mode" <> 'training' or (
      ("game_sessions"."spot_id" is null and "game_sessions"."scheduled_start_at" is null and "game_sessions"."timezone" is null and "game_sessions"."location_radius_meters" is null and "game_sessions"."location_max_accuracy_meters" is null and "game_sessions"."location_verification_ttl_seconds" is null)
      or ("game_sessions"."spot_id" is not null and "game_sessions"."scheduled_start_at" is null and "game_sessions"."timezone" is null and "game_sessions"."location_radius_meters" is not null and "game_sessions"."location_max_accuracy_meters" is not null and "game_sessions"."location_verification_ttl_seconds" is not null)
    )),
	CONSTRAINT "game_sessions_training_weather_check" CHECK (("game_sessions"."weather_confirmed" is null and "game_sessions"."weather_forecast_icon" is null and "game_sessions"."weather_observed_icon" is null and "game_sessions"."weather_reported_at" is null) or ("game_sessions"."weather_forecast_icon" is not null and "game_sessions"."weather_confirmed" is not null and "game_sessions"."weather_confirmed" in (true, false) and ("game_sessions"."weather_confirmed" = true or "game_sessions"."weather_observed_icon" is not null) and (("game_sessions"."spot_id" is not null) or ("game_sessions"."spot_id" is null and "game_sessions"."spot_removed")))),
	CONSTRAINT "game_sessions_weather_icon_check" CHECK ("game_sessions"."weather_forecast_icon" is null or "game_sessions"."weather_forecast_icon" in ('sunny','partly_cloudy_day','cloudy','rain','snow')),
	CONSTRAINT "game_sessions_weather_observed_icon_check" CHECK ("game_sessions"."weather_observed_icon" is null or "game_sessions"."weather_observed_icon" in ('sunny','partly_cloudy_day','cloudy','rain','snow')),
	CONSTRAINT "game_sessions_location_radius_meters_check" CHECK ("game_sessions"."location_radius_meters" is null or "game_sessions"."location_radius_meters" > 0),
	CONSTRAINT "game_sessions_location_max_accuracy_meters_check" CHECK ("game_sessions"."location_max_accuracy_meters" is null or "game_sessions"."location_max_accuracy_meters" > 0),
	CONSTRAINT "game_sessions_location_verification_ttl_seconds_check" CHECK ("game_sessions"."location_verification_ttl_seconds" is null or "game_sessions"."location_verification_ttl_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "league_email_log" (
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"day" integer NOT NULL,
	"recipients" text[] DEFAULT '{}' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_email_log_event_id_kind_day_pk" PRIMARY KEY("event_id","kind","day")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "permissions_slug_check" CHECK ("permissions"."slug" = lower("permissions"."slug") and length("permissions"."slug") > 0),
	CONSTRAINT "permissions_name_check" CHECK (length("permissions"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"initials" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"distance_unit" text DEFAULT 'mi' NOT NULL,
	"temperature_unit" text DEFAULT 'C' NOT NULL,
	"preferred_discipline_slug" text,
	CONSTRAINT "profiles_display_name_check" CHECK (length("profiles"."display_name") > 0),
	CONSTRAINT "profiles_email_check" CHECK ("profiles"."email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	CONSTRAINT "profiles_distance_unit_check" CHECK ("profiles"."distance_unit" in ('mi', 'km')),
	CONSTRAINT "profiles_temperature_unit_check" CHECK ("profiles"."temperature_unit" in ('C', 'F'))
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regions_slug_key" UNIQUE("slug"),
	CONSTRAINT "regions_name_check" CHECK (length("regions"."name") > 0),
	CONSTRAINT "regions_slug_check" CHECK (length("regions"."slug") > 0),
	CONSTRAINT "regions_sort_order_check" CHECK ("regions"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rider_score_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"round_id" uuid,
	"event_type" text NOT NULL,
	"points" integer NOT NULL,
	"trick_level" integer,
	"event_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rider_score_events_event_key_key" UNIQUE("event_key"),
	CONSTRAINT "rider_score_events_level_check" CHECK ("rider_score_events"."trick_level" is null or "rider_score_events"."trick_level" between 1 and 5),
	CONSTRAINT "rider_score_events_points_check" CHECK ("rider_score_events"."points" >= 0),
	CONSTRAINT "rider_score_events_event_type_check" CHECK ("rider_score_events"."event_type" in ('challenger_landed', 'response_landed', 'winner_bonus'))
);
--> statement-breakpoint
CREATE TABLE "rider_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"tricks_landed" integer DEFAULT 0 NOT NULL,
	"tricks_failed" integer DEFAULT 0 NOT NULL,
	"events_attended" integer DEFAULT 0 NOT NULL,
	"events_won" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rider_stats_total_points_check" CHECK ("rider_stats"."total_points" >= 0),
	CONSTRAINT "rider_stats_games_played_check" CHECK ("rider_stats"."games_played" >= 0),
	CONSTRAINT "rider_stats_games_won_check" CHECK ("rider_stats"."games_won" >= 0),
	CONSTRAINT "rider_stats_tricks_landed_check" CHECK ("rider_stats"."tricks_landed" >= 0),
	CONSTRAINT "rider_stats_tricks_failed_check" CHECK ("rider_stats"."tricks_failed" >= 0),
	CONSTRAINT "rider_stats_events_attended_check" CHECK ("rider_stats"."events_attended" >= 0),
	CONSTRAINT "rider_stats_events_won_check" CHECK ("rider_stats"."events_won" >= 0)
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "roles_slug_check" CHECK ("roles"."slug" = lower("roles"."slug") and length("roles"."slug") > 0),
	CONSTRAINT "roles_name_check" CHECK (length("roles"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "saved_spots" (
	"user_id" uuid NOT NULL,
	"spot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_spots_user_id_spot_id_pk" PRIMARY KEY("user_id","spot_id")
);
--> statement-breakpoint
CREATE TABLE "sport_disciplines" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sport_disciplines_name_check" CHECK (length("sport_disciplines"."name") > 0),
	CONSTRAINT "sport_disciplines_slug_check" CHECK (length("sport_disciplines"."slug") > 0),
	CONSTRAINT "sport_disciplines_sort_order_check" CHECK ("sport_disciplines"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sport_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"description" text DEFAULT '' NOT NULL,
	"origin" text DEFAULT 'community' NOT NULL,
	"visibility" text DEFAULT 'unlisted' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"timezone" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"schedule_published_at" timestamp with time zone,
	"payment_due_at" timestamp with time zone,
	"payment_deadline_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"results_published_at" timestamp with time zone,
	"city" text NOT NULL,
	"city_slug" text,
	"address" text,
	"country_code" text NOT NULL,
	"venue" text,
	"location" geography(Point, 4326),
	"spot_id" uuid,
	"spot_name_snapshot" text,
	"spot_city_snapshot" text,
	"category_slug" text DEFAULT 'local-event' NOT NULL,
	"plan_slug" text DEFAULT 'free' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"image_url" text NOT NULL,
	"url" text,
	"instagram" text,
	"youtube" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sport_events_slug_key" UNIQUE("slug"),
	CONSTRAINT "sport_events_origin_check" CHECK ("sport_events"."origin" in ('seed','community')),
	CONSTRAINT "sport_events_visibility_check" CHECK ("sport_events"."visibility" in ('public','unlisted')),
	CONSTRAINT "sport_events_status_check" CHECK ("sport_events"."status" in ('draft','registration_open','registration_closed','scheduled','live','completed','cancelled')),
	CONSTRAINT "sport_events_timezone_check" CHECK (length("sport_events"."timezone") > 0),
	CONSTRAINT "sport_events_city_check" CHECK (length("sport_events"."city") > 0),
	CONSTRAINT "sport_events_image_url_check" CHECK (length("sport_events"."image_url") > 0),
	CONSTRAINT "sport_events_name_check" CHECK (length("sport_events"."name") > 0),
	CONSTRAINT "sport_events_slug_check" CHECK (length("sport_events"."slug") > 0),
	CONSTRAINT "sport_events_version_check" CHECK ("sport_events"."version" >= 0),
	CONSTRAINT "sport_events_end_at_after_start_at_check" CHECK ("end_at" is null or "end_at" >= "start_at")
);
--> statement-breakpoint
CREATE TABLE "spot_challenge_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"spot_id" uuid,
	"spot_name_snapshot" text,
	"spot_slug_snapshot" text,
	"discipline_slug" text NOT NULL,
	"game_name" text NOT NULL,
	"elimination_word" text NOT NULL,
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"participant_count" integer NOT NULL,
	"verified_participant_count" integer NOT NULL,
	"spot_types_used" jsonb NOT NULL,
	"round_count_by_spot_type" jsonb NOT NULL,
	"initial_spot_type" text NOT NULL,
	"final_spot_type" text NOT NULL,
	"winner_player_id" uuid NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "spot_challenge_records_game_unique" UNIQUE("game_id"),
	CONSTRAINT "spot_challenge_records_status_check" CHECK ("spot_challenge_records"."status" = 'completed'),
	CONSTRAINT "spot_challenge_records_participant_count_check" CHECK ("spot_challenge_records"."participant_count" >= 2),
	CONSTRAINT "spot_challenge_records_verified_participant_count_check" CHECK ("spot_challenge_records"."verified_participant_count" >= 2),
	CONSTRAINT "spot_challenge_records_verified_le_participant_check" CHECK ("spot_challenge_records"."verified_participant_count" <= "spot_challenge_records"."participant_count"),
	CONSTRAINT "spot_challenge_records_timestamps_check" CHECK ("spot_challenge_records"."started_at" <= "spot_challenge_records"."completed_at")
);
--> statement-breakpoint
CREATE TABLE "spot_disciplines" (
	"spot_id" uuid NOT NULL,
	"discipline_slug" text NOT NULL,
	CONSTRAINT "spot_disciplines_spot_id_discipline_slug_pk" PRIMARY KEY("spot_id","discipline_slug")
);
--> statement-breakpoint
CREATE TABLE "spot_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spot_id" uuid NOT NULL,
	"path" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spot_images_spot_path_key" UNIQUE("spot_id","path"),
	CONSTRAINT "spot_images_path_check" CHECK (length("spot_images"."path") > 0),
	CONSTRAINT "spot_images_sort_order_check" CHECK ("spot_images"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "spot_type_assignments" (
	"spot_id" uuid NOT NULL,
	"type_slug" text NOT NULL,
	CONSTRAINT "spot_type_assignments_spot_id_type_slug_pk" PRIMARY KEY("spot_id","type_slug")
);
--> statement-breakpoint
CREATE TABLE "spot_types" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "spot_types_name_check" CHECK (length("spot_types"."name") > 0),
	CONSTRAINT "spot_types_slug_check" CHECK (length("spot_types"."slug") > 0),
	CONSTRAINT "spot_types_sort_order_check" CHECK ("spot_types"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "spot_weather_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spot_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"reporter_id" uuid,
	"forecast_icon" text NOT NULL,
	"observed_icon" text NOT NULL,
	"confirmed" boolean NOT NULL,
	"forecast_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spot_weather_reports_game_unique" UNIQUE("game_id"),
	CONSTRAINT "spot_weather_reports_forecast_icon_check" CHECK ("spot_weather_reports"."forecast_icon" in ('sunny','partly_cloudy_day','cloudy','rain','snow')),
	CONSTRAINT "spot_weather_reports_observed_icon_check" CHECK ("spot_weather_reports"."observed_icon" in ('sunny','partly_cloudy_day','cloudy','rain','snow'))
);
--> statement-breakpoint
CREATE TABLE "spot_weather_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote_icon" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "spot_weather_verifications_vote_icon_check" CHECK ("spot_weather_verifications"."vote_icon" in ('sunny','partly_cloudy_day','cloudy','rain','snow')),
	CONSTRAINT "spot_weather_verifications_expires_after_created_check" CHECK ("spot_weather_verifications"."expires_at" > "spot_weather_verifications"."created_at")
);
--> statement-breakpoint
CREATE TABLE "spots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"city_slug" text NOT NULL,
	"address" text NOT NULL,
	"image_url" text,
	"country_code" text NOT NULL,
	"instagram" text,
	"verification_count" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"origin" text DEFAULT 'seed' NOT NULL,
	"community_submission_count" integer DEFAULT 0 NOT NULL,
	"admin_hidden" boolean DEFAULT false NOT NULL,
	"types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sports" text[] DEFAULT '{}'::text[] NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spots_slug_key" UNIQUE("slug"),
	CONSTRAINT "spots_city_check" CHECK (length("spots"."city") > 0),
	CONSTRAINT "spots_city_slug_check" CHECK (length("spots"."city_slug") > 0),
	CONSTRAINT "spots_name_check" CHECK (length("spots"."name") > 0),
	CONSTRAINT "spots_slug_check" CHECK (length("spots"."slug") > 0),
	CONSTRAINT "spots_verification_count_check" CHECK ("spots"."verification_count" >= 0),
	CONSTRAINT "spots_visibility_check" CHECK ("spots"."visibility" in ('personal','public')),
	CONSTRAINT "spots_origin_check" CHECK ("spots"."origin" in ('seed','community','user_personal')),
	CONSTRAINT "spots_community_submission_count_check" CHECK ("spots"."community_submission_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trick_catalog_states" (
	"discipline_slug" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trick_catalog_states_version_check" CHECK ("trick_catalog_states"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trick_definition_spot_types" (
	"trick_id" uuid NOT NULL,
	"spot_type_slug" text NOT NULL,
	CONSTRAINT "trick_definition_spot_types_trick_id_spot_type_slug_pk" PRIMARY KEY("trick_id","spot_type_slug")
);
--> statement-breakpoint
CREATE TABLE "trick_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discipline_slug" text NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"level" integer NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trick_definitions_discipline_source_unique" UNIQUE("discipline_slug","source_id"),
	CONSTRAINT "trick_definitions_source_id_check" CHECK (char_length("trick_definitions"."source_id") > 0),
	CONSTRAINT "trick_definitions_name_check" CHECK (char_length("trick_definitions"."name") > 0),
	CONSTRAINT "trick_definitions_description_check" CHECK (char_length("trick_definitions"."description") > 0),
	CONSTRAINT "trick_definitions_level_check" CHECK ("trick_definitions"."level" between 1 and 5),
	CONSTRAINT "trick_definitions_categories_check" CHECK (jsonb_typeof("trick_definitions"."categories") = 'array' and jsonb_array_length("trick_definitions"."categories") <= 12)
);
--> statement-breakpoint
CREATE TABLE "tv_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"youtube_url" text NOT NULL,
	"discipline_slug" text NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"post_date" timestamp with time zone NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tv_videos_title_check" CHECK (length("tv_videos"."title") > 0),
	CONSTRAINT "tv_videos_youtube_url_check" CHECK (length("tv_videos"."youtube_url") > 0),
	CONSTRAINT "tv_videos_categories_check" CHECK (cardinality("tv_videos"."categories") >= 1 and cardinality("tv_videos"."categories") <= 12 and array_position("tv_videos"."categories", '') is null and array_position("tv_videos"."categories", null) is null),
	CONSTRAINT "tv_videos_sort_order_check" CHECK ("tv_videos"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_email_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_digests_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_event_plans" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plan_slug" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_event_plans_source_check" CHECK ("user_event_plans"."source" in ('payment','admin_grant')),
	CONSTRAINT "user_event_plans_status_check" CHECK ("user_event_plans"."status" in ('active','revoked'))
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"event_id" uuid,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "verified_spots" (
	"user_id" uuid NOT NULL,
	"spot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verified_spots_user_id_spot_id_pk" PRIMARY KEY("user_id","spot_id")
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_catalog_tricks" ADD CONSTRAINT "challenge_catalog_tricks_catalog_id_challenge_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."challenge_catalogs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_catalogs" ADD CONSTRAINT "challenge_catalogs_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_trick_spot_types" ADD CONSTRAINT "challenge_trick_spot_types_trick_id_challenge_catalog_tricks_id_fk" FOREIGN KEY ("trick_id") REFERENCES "public"."challenge_catalog_tricks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_trick_spot_types" ADD CONSTRAINT "challenge_trick_spot_types_spot_type_slug_spot_types_slug_fk" FOREIGN KEY ("spot_type_slug") REFERENCES "public"."spot_types"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_spot_submissions" ADD CONSTRAINT "community_spot_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_spot_submissions" ADD CONSTRAINT "community_spot_submissions_canonical_spot_id_spots_id_fk" FOREIGN KEY ("canonical_spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_audit_log" ADD CONSTRAINT "content_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_audit_log" ADD CONSTRAINT "content_audit_log_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curator_country_scopes" ADD CONSTRAINT "curator_country_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curator_country_scopes" ADD CONSTRAINT "curator_country_scopes_country_code_countries_iso2_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("iso2") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curator_country_scopes" ADD CONSTRAINT "curator_country_scopes_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curator_discipline_scopes" ADD CONSTRAINT "curator_discipline_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curator_discipline_scopes" ADD CONSTRAINT "curator_discipline_scopes_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curator_discipline_scopes" ADD CONSTRAINT "curator_discipline_scopes_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_action_requests" ADD CONSTRAINT "event_action_requests_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_action_requests" ADD CONSTRAINT "event_action_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_disciplines" ADD CONSTRAINT "event_disciplines_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_disciplines" ADD CONSTRAINT "event_disciplines_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_invites" ADD CONSTRAINT "event_invites_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_invites" ADD CONSTRAINT "event_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_joined_via_invite_id_event_invites_id_fk" FOREIGN KEY ("joined_via_invite_id") REFERENCES "public"."event_invites"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_plan_slug_event_plans_slug_fk" FOREIGN KEY ("plan_slug") REFERENCES "public"."event_plans"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_marked_paid_by_users_id_fk" FOREIGN KEY ("marked_paid_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_plans" ADD CONSTRAINT "event_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_plans" ADD CONSTRAINT "event_plans_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_points_ledger" ADD CONSTRAINT "event_points_ledger_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_points_ledger" ADD CONSTRAINT "event_points_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_realtime_signals" ADD CONSTRAINT "event_realtime_signals_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_run_id_event_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."event_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_membership_id_event_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."event_memberships"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_scores" ADD CONSTRAINT "event_scores_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_scores" ADD CONSTRAINT "event_scores_run_id_event_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."event_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_scores" ADD CONSTRAINT "event_scores_judge_user_id_users_id_fk" FOREIGN KEY ("judge_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_scoring_criteria" ADD CONSTRAINT "event_scoring_criteria_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_action_requests" ADD CONSTRAINT "game_action_requests_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_action_requests" ADD CONSTRAINT "game_action_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_location_verifications" ADD CONSTRAINT "game_location_verifications_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_location_verifications" ADD CONSTRAINT "game_location_verifications_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_location_verifications" ADD CONSTRAINT "game_location_verifications_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_location_verifications" ADD CONSTRAINT "game_location_verifications_player_game_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."game_players"("game_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_race_laps" ADD CONSTRAINT "game_race_laps_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_race_laps" ADD CONSTRAINT "game_race_laps_player_game_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."game_players"("game_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_realtime_signals" ADD CONSTRAINT "game_realtime_signals_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_catalog_trick_id_challenge_catalog_tricks_id_fk" FOREIGN KEY ("catalog_trick_id") REFERENCES "public"."challenge_catalog_tricks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_challenger_player_fk" FOREIGN KEY ("game_id","challenger_player_id") REFERENCES "public"."game_players"("game_id","id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_level_selected_fk" FOREIGN KEY ("game_id","level_selected_by_player_id") REFERENCES "public"."game_players"("game_id","id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_spot_type_changed_fk" FOREIGN KEY ("game_id","spot_type_changed_by_player_id") REFERENCES "public"."game_players"("game_id","id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_catalog_id_challenge_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."challenge_catalogs"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_winner_player_fk" FOREIGN KEY ("id","winner_player_id") REFERENCES "public"."game_players"("game_id","id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_current_round_fk" FOREIGN KEY ("id","current_round_id") REFERENCES "public"."game_rounds"("game_id","id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_current_challenger_player_fk" FOREIGN KEY ("id","current_challenger_player_id") REFERENCES "public"."game_players"("game_id","id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "league_email_log" ADD CONSTRAINT "league_email_log_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_preferred_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("preferred_discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rider_score_events" ADD CONSTRAINT "rider_score_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rider_score_events" ADD CONSTRAINT "rider_score_events_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rider_score_events" ADD CONSTRAINT "rider_score_events_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rider_score_events" ADD CONSTRAINT "rider_score_events_round_game_fk" FOREIGN KEY ("game_id","round_id") REFERENCES "public"."game_rounds"("game_id","id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rider_stats" ADD CONSTRAINT "rider_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saved_spots" ADD CONSTRAINT "saved_spots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saved_spots" ADD CONSTRAINT "saved_spots_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sport_events" ADD CONSTRAINT "sport_events_country_code_countries_iso2_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("iso2") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sport_events" ADD CONSTRAINT "sport_events_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sport_events" ADD CONSTRAINT "sport_events_category_slug_event_categories_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."event_categories"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sport_events" ADD CONSTRAINT "sport_events_plan_slug_event_plans_slug_fk" FOREIGN KEY ("plan_slug") REFERENCES "public"."event_plans"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sport_events" ADD CONSTRAINT "sport_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sport_events" ADD CONSTRAINT "sport_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_challenge_records" ADD CONSTRAINT "spot_challenge_records_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_challenge_records" ADD CONSTRAINT "spot_challenge_records_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_challenge_records" ADD CONSTRAINT "spot_challenge_records_winner_player_fk" FOREIGN KEY ("game_id","winner_player_id") REFERENCES "public"."game_players"("game_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_disciplines" ADD CONSTRAINT "spot_disciplines_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_disciplines" ADD CONSTRAINT "spot_disciplines_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_images" ADD CONSTRAINT "spot_images_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_type_assignments" ADD CONSTRAINT "spot_type_assignments_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_type_assignments" ADD CONSTRAINT "spot_type_assignments_type_slug_spot_types_slug_fk" FOREIGN KEY ("type_slug") REFERENCES "public"."spot_types"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_weather_reports" ADD CONSTRAINT "spot_weather_reports_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_weather_reports" ADD CONSTRAINT "spot_weather_reports_game_id_game_sessions_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_weather_reports" ADD CONSTRAINT "spot_weather_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_weather_verifications" ADD CONSTRAINT "spot_weather_verifications_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_weather_verifications" ADD CONSTRAINT "spot_weather_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_country_code_countries_iso2_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("iso2") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trick_catalog_states" ADD CONSTRAINT "trick_catalog_states_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trick_catalog_states" ADD CONSTRAINT "trick_catalog_states_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trick_definition_spot_types" ADD CONSTRAINT "trick_definition_spot_types_trick_id_trick_definitions_id_fk" FOREIGN KEY ("trick_id") REFERENCES "public"."trick_definitions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trick_definition_spot_types" ADD CONSTRAINT "trick_definition_spot_types_spot_type_slug_spot_types_slug_fk" FOREIGN KEY ("spot_type_slug") REFERENCES "public"."spot_types"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trick_definitions" ADD CONSTRAINT "trick_definitions_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trick_definitions" ADD CONSTRAINT "trick_definitions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tv_videos" ADD CONSTRAINT "tv_videos_discipline_slug_sport_disciplines_slug_fk" FOREIGN KEY ("discipline_slug") REFERENCES "public"."sport_disciplines"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tv_videos" ADD CONSTRAINT "tv_videos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tv_videos" ADD CONSTRAINT "tv_videos_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_event_plans" ADD CONSTRAINT "user_event_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_event_plans" ADD CONSTRAINT "user_event_plans_plan_slug_event_plans_slug_fk" FOREIGN KEY ("plan_slug") REFERENCES "public"."event_plans"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_event_plans" ADD CONSTRAINT "user_event_plans_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_event_id_sport_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sport_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "verified_spots" ADD CONSTRAINT "verified_spots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "verified_spots" ADD CONSTRAINT "verified_spots_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_idx" ON "admin_audit_log" USING btree ("target_user_id");
--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_idx" ON "admin_audit_log" USING btree ("actor_id");
--> statement-breakpoint
CREATE INDEX "challenge_catalog_tricks_catalog_level_idx" ON "challenge_catalog_tricks" USING btree ("catalog_id","level");
--> statement-breakpoint
CREATE INDEX "challenge_catalogs_discipline_idx" ON "challenge_catalogs" USING btree ("discipline_slug");
--> statement-breakpoint
CREATE INDEX "challenge_trick_spot_types_slug_idx" ON "challenge_trick_spot_types" USING btree ("spot_type_slug");
--> statement-breakpoint
CREATE INDEX "community_submissions_location_gist_idx" ON "community_spot_submissions" USING gist ("location");
--> statement-breakpoint
CREATE INDEX "community_submissions_hash_idx" ON "community_spot_submissions" USING btree ("submission_hash");
--> statement-breakpoint
CREATE INDEX "community_submissions_canonical_idx" ON "community_spot_submissions" USING btree ("canonical_spot_id");
--> statement-breakpoint
CREATE INDEX "content_audit_log_entity_idx" ON "content_audit_log" USING btree ("entity_type","entity_id","created_at");
--> statement-breakpoint
CREATE INDEX "content_audit_log_actor_idx" ON "content_audit_log" USING btree ("actor_id","created_at");
--> statement-breakpoint
CREATE INDEX "content_audit_log_discipline_idx" ON "content_audit_log" USING btree ("discipline_slug","created_at");
--> statement-breakpoint
CREATE INDEX "countries_region_idx" ON "countries" USING btree ("region_id");
--> statement-breakpoint
CREATE INDEX "curator_country_scopes_country_idx" ON "curator_country_scopes" USING btree ("country_code");
--> statement-breakpoint
CREATE INDEX "curator_discipline_scopes_discipline_idx" ON "curator_discipline_scopes" USING btree ("discipline_slug");
--> statement-breakpoint
CREATE INDEX "event_action_requests_created_idx" ON "event_action_requests" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "event_action_requests_user_action_key_idx" ON "event_action_requests" USING btree ("user_id","action","idempotency_key");
--> statement-breakpoint
CREATE INDEX "event_action_requests_event_action_created_idx" ON "event_action_requests" USING btree ("event_id","action","created_at");
--> statement-breakpoint
CREATE INDEX "event_categories_sort_order_idx" ON "event_categories" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "event_disciplines_discipline_idx" ON "event_disciplines" USING btree ("discipline_slug");
--> statement-breakpoint
CREATE INDEX "event_disciplines_discipline_event_idx" ON "event_disciplines" USING btree ("discipline_slug","event_id");
--> statement-breakpoint
CREATE INDEX "event_invites_event_role_idx" ON "event_invites" USING btree ("event_id","role");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_memberships_event_user_active_unique" ON "event_memberships" USING btree ("event_id","user_id") WHERE "event_memberships"."status" = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX "event_memberships_main_organizer_unique" ON "event_memberships" USING btree ("event_id") WHERE "event_memberships"."role" = 'main_organizer' and "event_memberships"."status" = 'active';
--> statement-breakpoint
CREATE INDEX "event_memberships_user_status_idx" ON "event_memberships" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "event_memberships_event_role_status_idx" ON "event_memberships" USING btree ("event_id","role","status");
--> statement-breakpoint
CREATE INDEX "event_payments_event_idx" ON "event_payments" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "event_payments_status_created_idx" ON "event_payments" USING btree ("status","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "event_payments_event_active_unique" ON "event_payments" USING btree ("event_id") WHERE "event_payments"."status" in ('pending','paid','comped');
--> statement-breakpoint
CREATE UNIQUE INDEX "event_plans_default_unique" ON "event_plans" USING btree ("is_default") WHERE "event_plans"."is_default" and "event_plans"."active";
--> statement-breakpoint
CREATE INDEX "event_points_ledger_user_created_idx" ON "event_points_ledger" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "event_points_ledger_event_idx" ON "event_points_ledger" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "event_realtime_signals_event_created_idx" ON "event_realtime_signals" USING btree ("event_id","created_at");
--> statement-breakpoint
CREATE INDEX "event_results_user_published_idx" ON "event_results" USING btree ("user_id","published_at");
--> statement-breakpoint
CREATE INDEX "event_runs_event_status_idx" ON "event_runs" USING btree ("event_id","status");
--> statement-breakpoint
CREATE INDEX "event_scores_event_idx" ON "event_scores" USING btree ("event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "game_action_requests_scope_unique" ON "game_action_requests" USING btree ("game_id","user_id","action","idempotency_key") WHERE "game_action_requests"."user_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "game_action_requests_guest_scope_unique" ON "game_action_requests" USING btree ("game_id","guest_token","action","idempotency_key") WHERE "game_action_requests"."guest_token" is not null;
--> statement-breakpoint
CREATE INDEX "game_action_requests_created_idx" ON "game_action_requests" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "game_action_requests_user_action_key_idx" ON "game_action_requests" USING btree ("user_id","action","idempotency_key");
--> statement-breakpoint
CREATE INDEX "game_action_requests_game_action_created_idx" ON "game_action_requests" USING btree ("game_id","action","created_at");
--> statement-breakpoint
CREATE INDEX "game_attempts_round_submitted_idx" ON "game_attempts" USING btree ("round_id","submitted_at");
--> statement-breakpoint
CREATE INDEX "game_location_verifications_game_round_idx" ON "game_location_verifications" USING btree ("game_id","round_id");
--> statement-breakpoint
CREATE INDEX "game_location_verifications_player_verified_idx" ON "game_location_verifications" USING btree ("player_id","verified_at");
--> statement-breakpoint
CREATE INDEX "game_location_verifications_spot_idx" ON "game_location_verifications" USING btree ("spot_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_game_user_unique" ON "game_players" USING btree ("game_id","user_id") WHERE "game_players"."user_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_game_guest_unique" ON "game_players" USING btree ("game_id","guest_token") WHERE "game_players"."guest_token" is not null;
--> statement-breakpoint
CREATE INDEX "game_players_guest_token_idx" ON "game_players" USING btree ("guest_token") WHERE "game_players"."guest_token" is not null;
--> statement-breakpoint
CREATE INDEX "game_players_game_status_idx" ON "game_players" USING btree ("game_id","status");
--> statement-breakpoint
CREATE INDEX "game_players_user_id_idx" ON "game_players" USING btree ("user_id") WHERE "game_players"."user_id" is not null;
--> statement-breakpoint
CREATE INDEX "game_race_laps_game_lap_idx" ON "game_race_laps" USING btree ("game_id","lap_number");
--> statement-breakpoint
CREATE INDEX "game_race_laps_game_player_lap_time_idx" ON "game_race_laps" USING btree ("game_id","player_id","lap_number","milliseconds");
--> statement-breakpoint
CREATE INDEX "game_race_laps_player_time_idx" ON "game_race_laps" USING btree ("player_id","milliseconds");
--> statement-breakpoint
CREATE INDEX "game_realtime_signals_game_created_idx" ON "game_realtime_signals" USING btree ("game_id","created_at");
--> statement-breakpoint
CREATE INDEX "game_rounds_game_status_idx" ON "game_rounds" USING btree ("game_id","status");
--> statement-breakpoint
CREATE INDEX "game_rounds_catalog_trick_idx" ON "game_rounds" USING btree ("catalog_trick_id");
--> statement-breakpoint
CREATE INDEX "game_sessions_created_by_idx" ON "game_sessions" USING btree ("created_by","created_at");
--> statement-breakpoint
CREATE INDEX "game_sessions_training_ip_status_idx" ON "game_sessions" USING btree ("creator_ip_hash","mode","status");
--> statement-breakpoint
CREATE INDEX "game_sessions_spot_idx" ON "game_sessions" USING btree ("spot_id");
--> statement-breakpoint
CREATE INDEX "game_sessions_mode_status_idx" ON "game_sessions" USING btree ("mode","status");
--> statement-breakpoint
CREATE INDEX "game_sessions_current_round_idx" ON "game_sessions" USING btree ("current_round_id");
--> statement-breakpoint
CREATE INDEX "game_sessions_racing_leaderboard_idx" ON "game_sessions" USING btree ("game_format","status","lap_count");
--> statement-breakpoint
CREATE INDEX "profiles_preferred_discipline_idx" ON "profiles" USING btree ("preferred_discipline_slug");
--> statement-breakpoint
CREATE INDEX "regions_sort_order_idx" ON "regions" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "rider_score_events_game_round_idx" ON "rider_score_events" USING btree ("game_id","round_id");
--> statement-breakpoint
CREATE INDEX "rider_score_events_user_created_idx" ON "rider_score_events" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");
--> statement-breakpoint
CREATE INDEX "saved_spots_user_created_idx" ON "saved_spots" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "saved_spots_spot_idx" ON "saved_spots" USING btree ("spot_id");
--> statement-breakpoint
CREATE INDEX "sport_disciplines_sort_order_idx" ON "sport_disciplines" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "sport_events_country_code_idx" ON "sport_events" USING btree ("country_code");
--> statement-breakpoint
CREATE INDEX "sport_events_category_slug_idx" ON "sport_events" USING btree ("category_slug");
--> statement-breakpoint
CREATE INDEX "sport_events_plan_slug_idx" ON "sport_events" USING btree ("plan_slug");
--> statement-breakpoint
CREATE INDEX "sport_events_start_at_idx" ON "sport_events" USING btree ("start_at");
--> statement-breakpoint
CREATE INDEX "sport_events_start_at_id_idx" ON "sport_events" USING btree ("start_at","id");
--> statement-breakpoint
CREATE INDEX "sport_events_country_start_at_idx" ON "sport_events" USING btree ("country_code","start_at");
--> statement-breakpoint
CREATE INDEX "sport_events_city_slug_idx" ON "sport_events" USING btree ("city_slug");
--> statement-breakpoint
CREATE INDEX "sport_events_location_gist_idx" ON "sport_events" USING gist ("location");
--> statement-breakpoint
CREATE INDEX "sport_events_origin_idx" ON "sport_events" USING btree ("origin");
--> statement-breakpoint
CREATE INDEX "sport_events_visibility_idx" ON "sport_events" USING btree ("visibility");
--> statement-breakpoint
CREATE INDEX "sport_events_status_idx" ON "sport_events" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sport_events_featured_idx" ON "sport_events" USING btree ("featured");
--> statement-breakpoint
CREATE INDEX "sport_events_payment_deadline_idx" ON "sport_events" USING btree ("payment_deadline_at");
--> statement-breakpoint
CREATE INDEX "sport_events_created_by_origin_created_idx" ON "sport_events" USING btree ("created_by","origin","created_at");
--> statement-breakpoint
CREATE INDEX "sport_events_name_trgm_idx" ON "sport_events" USING gin (lower("name") gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "sport_events_city_trgm_idx" ON "sport_events" USING gin (lower("city") gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "spot_challenge_records_spot_completed_idx" ON "spot_challenge_records" USING btree ("spot_id","completed_at");
--> statement-breakpoint
CREATE INDEX "spot_disciplines_discipline_idx" ON "spot_disciplines" USING btree ("discipline_slug");
--> statement-breakpoint
CREATE INDEX "spot_disciplines_discipline_spot_idx" ON "spot_disciplines" USING btree ("discipline_slug","spot_id");
--> statement-breakpoint
CREATE INDEX "spot_images_spot_id_sort_order_idx" ON "spot_images" USING btree ("spot_id","sort_order");
--> statement-breakpoint
CREATE INDEX "spot_type_assignments_type_idx" ON "spot_type_assignments" USING btree ("type_slug");
--> statement-breakpoint
CREATE INDEX "spot_type_assignments_type_spot_idx" ON "spot_type_assignments" USING btree ("type_slug","spot_id");
--> statement-breakpoint
CREATE INDEX "spot_types_sort_order_idx" ON "spot_types" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "spot_weather_reports_spot_created_idx" ON "spot_weather_reports" USING btree ("spot_id","created_at");
--> statement-breakpoint
CREATE INDEX "spot_weather_reports_game_idx" ON "spot_weather_reports" USING btree ("game_id");
--> statement-breakpoint
CREATE INDEX "spot_weather_verifications_spot_expires_idx" ON "spot_weather_verifications" USING btree ("spot_id","expires_at");
--> statement-breakpoint
CREATE INDEX "spot_weather_verifications_spot_created_idx" ON "spot_weather_verifications" USING btree ("spot_id","created_at");
--> statement-breakpoint
CREATE INDEX "spot_weather_verifications_user_spot_created_idx" ON "spot_weather_verifications" USING btree ("user_id","spot_id","created_at");
--> statement-breakpoint
CREATE INDEX "spots_country_code_idx" ON "spots" USING btree ("country_code");
--> statement-breakpoint
CREATE INDEX "spots_city_slug_idx" ON "spots" USING btree ("city_slug");
--> statement-breakpoint
CREATE INDEX "spots_location_gist_idx" ON "spots" USING gist ("location");
--> statement-breakpoint
CREATE INDEX "spots_visibility_idx" ON "spots" USING btree ("visibility");
--> statement-breakpoint
CREATE INDEX "spots_origin_idx" ON "spots" USING btree ("origin");
--> statement-breakpoint
CREATE INDEX "spots_admin_hidden_idx" ON "spots" USING btree ("admin_hidden");
--> statement-breakpoint
CREATE INDEX "spots_admin_hidden_visibility_idx" ON "spots" USING btree ("admin_hidden","visibility");
--> statement-breakpoint
CREATE INDEX "trick_definition_spot_types_slug_idx" ON "trick_definition_spot_types" USING btree ("spot_type_slug");
--> statement-breakpoint
CREATE INDEX "trick_definitions_discipline_level_idx" ON "trick_definitions" USING btree ("discipline_slug","level");
--> statement-breakpoint
CREATE INDEX "tv_videos_published_discipline_post_date_idx" ON "tv_videos" USING btree ("published","discipline_slug","post_date");
--> statement-breakpoint
CREATE INDEX "tv_videos_categories_gin_idx" ON "tv_videos" USING gin ("categories");
--> statement-breakpoint
CREATE INDEX "tv_videos_published_sort_idx" ON "tv_videos" USING btree ("published","sort_order","created_at");
--> statement-breakpoint
CREATE INDEX "tv_videos_discipline_idx" ON "tv_videos" USING btree ("discipline_slug");
--> statement-breakpoint
CREATE INDEX "tv_videos_published_keyset_idx" ON "tv_videos" USING btree ("sort_order","post_date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "tv_videos"."published" = true;
--> statement-breakpoint
CREATE INDEX "tv_videos_published_discipline_keyset_idx" ON "tv_videos" USING btree ("discipline_slug","sort_order","post_date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "tv_videos"."published" = true;
--> statement-breakpoint
CREATE INDEX "user_event_plans_plan_slug_idx" ON "user_event_plans" USING btree ("plan_slug");
--> statement-breakpoint
CREATE INDEX "user_notifications_user_created_idx" ON "user_notifications" USING btree ("user_id","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "user_notifications_user_unread_idx" ON "user_notifications" USING btree ("user_id") WHERE "user_notifications"."read_at" is null;
--> statement-breakpoint
CREATE INDEX "user_notifications_event_idx" ON "user_notifications" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "user_notifications_email_pending_idx" ON "user_notifications" USING btree ("created_at") WHERE "user_notifications"."emailed_at" is null and "user_notifications"."type" in
        ('league_invite_received','league_registration_confirmed','league_schedule_published','league_event_started','league_event_cancelled','league_results_published','league_points_earned');
--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");
--> statement-breakpoint
CREATE INDEX "verified_spots_user_created_idx" ON "verified_spots" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "verified_spots_spot_idx" ON "verified_spots" USING btree ("spot_id");
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
CREATE OR REPLACE FUNCTION public.emit_event_realtime_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.version IS NOT DISTINCT FROM OLD.version THEN RETURN NEW; END IF;
  INSERT INTO public.event_realtime_signals (event_id, version, signal_type)
  VALUES (
    NEW.id,
    NEW.version,
    CASE NEW.status
      WHEN 'cancelled' THEN 'event_cancelled'
      ELSE 'event_state_changed'
    END
  )
  ON CONFLICT (event_id, version) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "sport_events_realtime_signal_trigger"
AFTER UPDATE OF version ON "sport_events"
FOR EACH ROW
EXECUTE FUNCTION public.emit_event_realtime_signal();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_game_session_catalog_definition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  catalog_record record;
BEGIN
  SELECT discipline_slug, challenge_key, game_name, elimination_word, word_length
    INTO catalog_record
    FROM public.challenge_catalogs
   WHERE id = NEW.catalog_id;
  IF catalog_record.discipline_slug IS NULL
     OR catalog_record.discipline_slug <> NEW.discipline_slug
     OR catalog_record.challenge_key <> NEW.challenge_key
     OR catalog_record.game_name <> NEW.game_name
     OR catalog_record.elimination_word <> NEW.elimination_word
     OR catalog_record.word_length <> NEW.word_length THEN
    RAISE EXCEPTION 'Game definition does not match its challenge catalog';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "game_session_catalog_definition_trigger"
BEFORE INSERT OR UPDATE ON "game_sessions"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_game_session_catalog_definition();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_immutable_game_definition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW.discipline_slug IS DISTINCT FROM OLD.discipline_slug
     OR NEW.challenge_key IS DISTINCT FROM OLD.challenge_key
     OR NEW.game_name IS DISTINCT FROM OLD.game_name
     OR NEW.elimination_word IS DISTINCT FROM OLD.elimination_word
     OR NEW.word_length IS DISTINCT FROM OLD.word_length
     OR NEW.catalog_id IS DISTINCT FROM OLD.catalog_id
     OR (OLD.training_variant = 'solo' AND NEW.training_variant IS DISTINCT FROM OLD.training_variant) THEN
    RAISE EXCEPTION 'Game mode, definition, catalog, and training variant are immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "game_sessions_immutable_definition_trigger"
BEFORE UPDATE ON "game_sessions"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_immutable_game_definition();
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
SET search_path = public
AS $$
  SELECT replace(replace(replace(replace(replace(
    raw,
    '&', '&amp;'),
    '<', '&lt;'),
    '>', '&gt;'),
    '"', '&quot;'),
    '''', '&#39;')
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
CREATE OR REPLACE FUNCTION public.league_email_sweep()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions, cron, net
AS $$
DECLARE
  api_key text;
  from_addr text;
  app_url text;
  rec record;
  link text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets') THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF api_key IS NULL OR api_key = '' THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO from_addr
    FROM vault.decrypted_secrets WHERE name = 'email_from' LIMIT 1;
  SELECT decrypted_secret INTO app_url
    FROM vault.decrypted_secrets WHERE name = 'app_public_url' LIMIT 1;
  IF from_addr IS NULL OR from_addr = '' THEN
    from_addr := 'OpenSpot <onboarding@resend.dev>';
  END IF;
  IF app_url IS NULL OR app_url = '' THEN
    app_url := 'https://openspot.app';
  END IF;

  FOR rec IN
    SELECT e.id, e.name, e.slug, au.email AS creator_email, max(d.day) AS day
    FROM sport_events e
    JOIN auth.users au ON au.id = e.created_by
    JOIN (VALUES (2), (3), (6)) AS d(day)
      ON (now() - e.created_at) >= make_interval(days => d.day)
    WHERE e.origin = 'community'
      AND e.status NOT IN ('completed', 'cancelled')
      AND au.email IS NOT NULL AND au.email <> ''
      AND NOT EXISTS (
        SELECT 1 FROM event_payments p
        WHERE p.event_id = e.id AND p.status IN ('paid', 'comped'))
    GROUP BY e.id, e.name, e.slug, au.email
  LOOP
    INSERT INTO league_email_log(event_id, kind, day, recipients)
      VALUES (rec.id, 'payment_reminder', rec.day, ARRAY[rec.creator_email])
      ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_slug text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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
SET search_path = public, pg_temp
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
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.curator_discipline_scopes
    WHERE user_id = p_user_id AND discipline_slug = p_discipline_slug
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_game_participant(target_game_id uuid, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_players
     WHERE game_id = target_game_id
       AND user_id = subject_user_id
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_round_participant(target_round_id uuid, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.game_rounds r
     WHERE r.id = target_round_id
       AND public.is_game_participant(r.game_id, subject_user_id)
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_event_participant(target_event_id uuid, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.event_memberships m
     WHERE m.event_id = target_event_id
       AND m.user_id = subject_user_id
       AND m.status = 'active'
  ) OR EXISTS (
    SELECT 1
      FROM public.sport_events e
     WHERE e.id = target_event_id
       AND e.created_by = subject_user_id
  );
$$;
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
