-- Open Spot application baseline
--
-- This is the only active application migration. Run it after
-- `pnpm db:reset` against a non-production Supabase database. Supabase-owned
-- auth, storage, extensions, and managed schemas are intentionally not
-- dropped here.

CREATE EXTENSION IF NOT EXISTS postgis;
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

CREATE TABLE "spot_types" (
  "slug" text PRIMARY KEY NOT NULL CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint

CREATE INDEX "spot_types_sort_order_idx" ON "spot_types" ("sort_order");
--> statement-breakpoint

CREATE TABLE "sport_disciplines" (
  "slug" text PRIMARY KEY NOT NULL CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint

CREATE INDEX "sport_disciplines_sort_order_idx" ON "sport_disciplines" ("sort_order");
--> statement-breakpoint

CREATE TABLE "event_tiers" (
  "slug" text PRIMARY KEY NOT NULL CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint

CREATE INDEX "event_tiers_sort_order_idx" ON "event_tiers" ("sort_order");
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

CREATE TABLE "spots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "city" text NOT NULL CHECK (length("city") > 0),
  "city_slug" text NOT NULL CHECK (length("city_slug") > 0),
  "address" text NOT NULL,
  "image_url" text NOT NULL CHECK (length("image_url") > 0),
  "image_path" text,
  "country_code" text NOT NULL REFERENCES "countries"("iso2") ON DELETE CASCADE,
  "instagram" text,
  "verification_count" integer NOT NULL DEFAULT 0 CHECK ("verification_count" >= 0),
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

CREATE TABLE "sport_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "short_name" text,
  "url" text NOT NULL CHECK (length("url") > 0),
  "image_url" text NOT NULL CHECK (length("image_url") > 0),
  "image_path" text,
  "description" text NOT NULL DEFAULT '',
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz,
  "city" text NOT NULL CHECK (length("city") > 0),
  "city_slug" text,
  "address" text,
  "country_code" text NOT NULL REFERENCES "countries"("iso2") ON DELETE CASCADE,
  "venue" text,
  "location" geography(Point, 4326),
  "tier_slug" text NOT NULL REFERENCES "event_tiers"("slug") ON DELETE RESTRICT,
  "featured" boolean NOT NULL DEFAULT false,
  "instagram" text,
  "youtube" text,
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "sport_events_end_at_after_start_at_check" CHECK ("end_at" IS NULL OR "end_at" >= "start_at")
);
--> statement-breakpoint

CREATE INDEX "sport_events_country_code_idx" ON "sport_events" ("country_code");
--> statement-breakpoint

CREATE INDEX "sport_events_tier_slug_idx" ON "sport_events" ("tier_slug");
--> statement-breakpoint

CREATE INDEX "sport_events_start_at_idx" ON "sport_events" ("start_at");
--> statement-breakpoint

CREATE INDEX "sport_events_start_at_id_idx" ON "sport_events" ("start_at", "id");
--> statement-breakpoint

CREATE INDEX "sport_events_country_start_at_idx" ON "sport_events" ("country_code", "start_at");
--> statement-breakpoint

CREATE INDEX "sport_events_city_slug_idx" ON "sport_events" ("city_slug");
--> statement-breakpoint

CREATE INDEX "sport_events_location_gist_idx" ON "sport_events" USING gist ("location");
--> statement-breakpoint

CREATE TABLE "external_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform" text NOT NULL CHECK ("platform" IN ('youtube', 'instagram')),
  "title" text NOT NULL CHECK (length("title") > 0),
  "url" text NOT NULL CHECK (length("url") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "published" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "external_posts_platform_url_unique" UNIQUE ("platform", "url")
);
--> statement-breakpoint

CREATE INDEX "external_posts_published_sort_idx" ON "external_posts" ("published", "sort_order", "created_at");
--> statement-breakpoint

CREATE TABLE "spot_disciplines" (
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  CONSTRAINT "spot_disciplines_pkey" PRIMARY KEY ("spot_id", "discipline_slug")
);
--> statement-breakpoint

CREATE INDEX "spot_disciplines_discipline_idx" ON "spot_disciplines" ("discipline_slug");
--> statement-breakpoint

CREATE TABLE "event_disciplines" (
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  CONSTRAINT "event_disciplines_pkey" PRIMARY KEY ("event_id", "discipline_slug")
);
--> statement-breakpoint

CREATE INDEX "event_disciplines_discipline_idx" ON "event_disciplines" ("discipline_slug");
--> statement-breakpoint

CREATE TABLE "spot_type_assignments" (
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "type_slug" text NOT NULL REFERENCES "spot_types"("slug") ON DELETE RESTRICT,
  CONSTRAINT "spot_type_assignments_pkey" PRIMARY KEY ("spot_id", "type_slug")
);
--> statement-breakpoint

CREATE INDEX "spot_type_assignments_type_idx" ON "spot_type_assignments" ("type_slug");
--> statement-breakpoint

CREATE TABLE "saved_spots" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "saved_spots_pkey" PRIMARY KEY ("user_id", "spot_id")
);
--> statement-breakpoint

CREATE INDEX "saved_spots_user_created_idx" ON "saved_spots" ("user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "saved_spots_spot_idx" ON "saved_spots" ("spot_id");
--> statement-breakpoint

CREATE TABLE "verified_spots" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "verified_spots_pkey" PRIMARY KEY ("user_id", "spot_id")
);
--> statement-breakpoint

CREATE INDEX "verified_spots_user_created_idx" ON "verified_spots" ("user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "verified_spots_spot_idx" ON "verified_spots" ("spot_id");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.bump_verification_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.spots
       SET verification_count = verification_count + 1,
           updated_at = now()
     WHERE id = NEW.spot_id;
    RETURN NEW;
  END IF;
  UPDATE public.spots
     SET verification_count = greatest(verification_count - 1, 0),
         updated_at = now()
   WHERE id = OLD.spot_id;
  RETURN OLD;
END
$$;
--> statement-breakpoint

CREATE TRIGGER "verified_spots_count_sync"
AFTER INSERT OR DELETE ON "verified_spots"
FOR EACH ROW EXECUTE FUNCTION public.bump_verification_count();
--> statement-breakpoint

CREATE TABLE "trick_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "source_id" text NOT NULL,
  "name" text NOT NULL CHECK (char_length("name") > 0),
  "description" text NOT NULL CHECK (char_length("description") > 0),
  "level" integer NOT NULL CHECK ("level" BETWEEN 1 AND 3),
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "trick_definitions_discipline_source_unique" UNIQUE ("discipline_slug", "source_id"),
  CONSTRAINT "trick_definitions_source_id_check" CHECK (char_length("source_id") > 0)
);
--> statement-breakpoint

CREATE INDEX "trick_definitions_discipline_level_idx" ON "trick_definitions" ("discipline_slug", "level");
--> statement-breakpoint

CREATE TABLE "trick_definition_spot_types" (
  "trick_id" uuid NOT NULL REFERENCES "trick_definitions"("id") ON DELETE CASCADE,
  "spot_type_slug" text NOT NULL REFERENCES "spot_types"("slug") ON DELETE RESTRICT,
  CONSTRAINT "trick_definition_spot_types_pkey" PRIMARY KEY ("trick_id", "spot_type_slug")
);
--> statement-breakpoint

CREATE INDEX "trick_definition_spot_types_slug_idx" ON "trick_definition_spot_types" ("spot_type_slug");
--> statement-breakpoint

CREATE TABLE "trick_catalog_states" (
  "discipline_slug" text PRIMARY KEY NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "version" integer NOT NULL DEFAULT 0 CHECK ("version" >= 0),
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "challenge_catalogs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
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
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "challenge_catalogs_discipline_sha_unique" UNIQUE ("discipline_slug", "source_sha256"),
  CONSTRAINT "challenge_catalogs_challenge_key_lower_check" CHECK ("challenge_key" = lower("challenge_key")),
  CONSTRAINT "challenge_catalogs_elimination_word_upper_check" CHECK ("elimination_word" = upper("elimination_word")),
  CONSTRAINT "challenge_catalogs_word_length_check" CHECK ("word_length" = char_length("elimination_word")),
  CONSTRAINT "challenge_catalogs_discipline_slug_check" CHECK ("discipline_slug" IN ('roller', 'skateboard', 'bmx', 'scooter')),
  CONSTRAINT "challenge_catalogs_challenge_key_check" CHECK ("challenge_key" IN ('blade', 'skate', 'bike', 'scoot')),
  CONSTRAINT "challenge_catalogs_counts_check" CHECK ("trick_count" >= 1 AND "level_one_count" + "level_two_count" + "level_three_count" = "trick_count"),
  CONSTRAINT "challenge_catalogs_definition_consistency_check" CHECK (
    ("discipline_slug" = 'roller' AND "challenge_key" = 'blade' AND "game_name" = 'Play a Blade' AND "elimination_word" = 'BLADE' AND "word_length" = 5) OR
    ("discipline_slug" = 'skateboard' AND "challenge_key" = 'skate' AND "game_name" = 'Play a Skate' AND "elimination_word" = 'SKATE' AND "word_length" = 5) OR
    ("discipline_slug" = 'bmx' AND "challenge_key" = 'bike' AND "game_name" = 'Play a Bike' AND "elimination_word" = 'BIKE' AND "word_length" = 4) OR
    ("discipline_slug" = 'scooter' AND "challenge_key" = 'scoot' AND "game_name" = 'Play a Scoot' AND "elimination_word" = 'SCOOT' AND "word_length" = 5)
  )
);
--> statement-breakpoint

CREATE INDEX "challenge_catalogs_discipline_idx" ON "challenge_catalogs" ("discipline_slug");
--> statement-breakpoint

CREATE TABLE "challenge_catalog_tricks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "catalog_id" uuid NOT NULL REFERENCES "challenge_catalogs"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL CHECK (char_length("source_id") > 0),
  "name" text NOT NULL CHECK (char_length("name") > 0),
  "description" text NOT NULL CHECK (char_length("description") > 0),
  "level" integer NOT NULL CHECK ("level" BETWEEN 1 AND 3),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "challenge_catalog_tricks_catalog_source_unique" UNIQUE ("catalog_id", "source_id")
);
--> statement-breakpoint

CREATE INDEX "challenge_catalog_tricks_catalog_level_idx" ON "challenge_catalog_tricks" ("catalog_id", "level");
--> statement-breakpoint

CREATE TABLE "challenge_trick_spot_types" (
  "trick_id" uuid NOT NULL REFERENCES "challenge_catalog_tricks"("id") ON DELETE CASCADE,
  "spot_type_slug" text NOT NULL REFERENCES "spot_types"("slug") ON DELETE RESTRICT,
  CONSTRAINT "challenge_trick_spot_types_pkey" PRIMARY KEY ("trick_id", "spot_type_slug")
);
--> statement-breakpoint

CREATE INDEX "challenge_trick_spot_types_slug_idx" ON "challenge_trick_spot_types" ("spot_type_slug");
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
END
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
END
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
    slug := item ->> 'slug';
    IF slug = ANY(seen) THEN RETURN false; END IF;
    seen := array_append(seen, slug);
  END LOOP;
  RETURN true;
END
$$;
--> statement-breakpoint

CREATE TABLE "game_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "share_code" text NOT NULL UNIQUE,
  "mode" text NOT NULL CHECK ("mode" IN ('challenge', 'training')),
  "rule_mode" text NOT NULL DEFAULT 'flexible' CHECK ("rule_mode" IN ('strict', 'flexible')),
  "game_format" text NOT NULL DEFAULT 'tricks' CHECK ("game_format" IN ('tricks', 'bmx_track_racing')),
  "training_variant" text NOT NULL DEFAULT 'multiplayer' CHECK ("training_variant" IN ('multiplayer', 'solo')),
  "lap_count" integer,
  "ghost_mode" text NOT NULL DEFAULT 'off' CHECK ("ghost_mode" IN ('off', 'global_best')),
  "discipline_slug" text NOT NULL CHECK ("discipline_slug" IN ('roller', 'skateboard', 'bmx', 'scooter')),
  "challenge_key" text NOT NULL CHECK ("challenge_key" IN ('blade', 'skate', 'bike', 'scoot')),
  "game_name" text NOT NULL,
  "elimination_word" text NOT NULL CHECK ("elimination_word" = upper("elimination_word")),
  "word_length" integer NOT NULL CHECK ("word_length" = char_length("elimination_word")),
  "catalog_id" uuid NOT NULL REFERENCES "challenge_catalogs"("id") ON DELETE RESTRICT,
  "spot_id" uuid REFERENCES "spots"("id") ON DELETE RESTRICT,
  "scheduled_start_at" timestamptz,
  "timezone" text,
  "location_radius_meters" integer,
  "location_max_accuracy_meters" integer,
  "location_verification_ttl_seconds" integer,
  "weather_forecast_icon" text,
  "weather_forecast_description" text,
  "weather_forecast_temp" integer,
  "weather_observed_icon" text,
  "weather_confirmed" boolean,
  "weather_reported_at" timestamptz,
  "weather_forecast_snapshot" jsonb,
  "available_spot_types" jsonb NOT NULL,
  "initial_spot_type" text NOT NULL,
  "next_spot_type" text NOT NULL,
  "next_level" integer CHECK ("next_level" IS NULL OR "next_level" BETWEEN 1 AND 3),
  "status" text NOT NULL DEFAULT 'lobby' CHECK ("status" IN ('lobby', 'active', 'complete', 'cancelled')),
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "creator_ip_hash" text NOT NULL,
  "creator_display_name" text NOT NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "cancelled_at" timestamptz,
  "winner_player_id" uuid,
  "current_round_id" uuid,
  "current_challenger_player_id" uuid,
  "rotation_order" jsonb NOT NULL,
  "rotation_index" integer NOT NULL DEFAULT 0 CHECK ("rotation_index" >= 0),
  "version" integer NOT NULL DEFAULT 0 CHECK ("version" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_sessions_definition_consistency_check" CHECK (
    ("discipline_slug" = 'roller' AND "challenge_key" = 'blade' AND "game_name" = 'Play a Blade' AND "elimination_word" = 'BLADE' AND "word_length" = 5) OR
    ("discipline_slug" = 'skateboard' AND "challenge_key" = 'skate' AND "game_name" = 'Play a Skate' AND "elimination_word" = 'SKATE' AND "word_length" = 5) OR
    ("discipline_slug" = 'bmx' AND "challenge_key" = 'bike' AND "game_name" = 'Play a Bike' AND "elimination_word" = 'BIKE' AND "word_length" = 4) OR
    ("discipline_slug" = 'scooter' AND "challenge_key" = 'scoot' AND "game_name" = 'Play a Scoot' AND "elimination_word" = 'SCOOT' AND "word_length" = 5)
  ),
  CONSTRAINT "game_sessions_racing_settings_check" CHECK ("game_format" <> 'bmx_track_racing' OR ("discipline_slug" = 'bmx' AND "lap_count" BETWEEN 1 AND 20 AND "ghost_mode" = 'global_best')),
  CONSTRAINT "game_sessions_solo_variant_check" CHECK ("training_variant" <> 'solo' OR ("mode" = 'training' AND "game_format" = 'tricks')),
  CONSTRAINT "game_sessions_snapshot_nonempty_check" CHECK (jsonb_typeof("available_spot_types") = 'array' AND jsonb_array_length("available_spot_types") > 0),
  CONSTRAINT "game_sessions_challenge_requires_spot_check" CHECK ("mode" <> 'challenge' OR ("spot_id" IS NOT NULL AND "scheduled_start_at" IS NOT NULL AND "timezone" IS NOT NULL AND "location_radius_meters" IS NOT NULL AND "location_max_accuracy_meters" IS NOT NULL AND "location_verification_ttl_seconds" IS NOT NULL AND "created_by" IS NOT NULL)),
  CONSTRAINT "game_sessions_training_forbids_spot_check" CHECK ("mode" <> 'training' OR ("spot_id" IS NULL AND "scheduled_start_at" IS NULL AND "timezone" IS NULL AND "location_radius_meters" IS NULL AND "location_max_accuracy_meters" IS NULL AND "location_verification_ttl_seconds" IS NULL)),
  CONSTRAINT "game_sessions_training_weather_check" CHECK (("weather_confirmed" IS NULL AND "weather_forecast_icon" IS NULL AND "weather_observed_icon" IS NULL AND "weather_reported_at" IS NULL) OR ("spot_id" IS NOT NULL AND "weather_forecast_icon" IS NOT NULL AND "weather_confirmed" IS NOT NULL AND "weather_confirmed" IN (true, false) AND ("weather_confirmed" = true OR "weather_observed_icon" IS NOT NULL))),
  CONSTRAINT "game_sessions_weather_icon_check" CHECK ("weather_forecast_icon" IS NULL OR "weather_forecast_icon" IN ('sunny','partly_cloudy_day','cloudy','rain','snow')),
  CONSTRAINT "game_sessions_weather_observed_icon_check" CHECK ("weather_observed_icon" IS NULL OR "weather_observed_icon" IN ('sunny','partly_cloudy_day','cloudy','rain','snow')),
  CONSTRAINT "game_sessions_location_radius_meters_check" CHECK ("location_radius_meters" IS NULL OR "location_radius_meters" > 0),
  CONSTRAINT "game_sessions_location_max_accuracy_meters_check" CHECK ("location_max_accuracy_meters" IS NULL OR "location_max_accuracy_meters" > 0),
  CONSTRAINT "game_sessions_location_verification_ttl_seconds_check" CHECK ("location_verification_ttl_seconds" IS NULL OR "location_verification_ttl_seconds" > 0)
);
--> statement-breakpoint

CREATE INDEX "game_sessions_created_by_idx" ON "game_sessions" ("created_by", "created_at");
--> statement-breakpoint

CREATE INDEX "game_sessions_training_ip_status_idx" ON "game_sessions" ("creator_ip_hash", "mode", "status");
--> statement-breakpoint

CREATE INDEX "game_sessions_spot_idx" ON "game_sessions" ("spot_id");
--> statement-breakpoint

CREATE INDEX "game_sessions_mode_status_idx" ON "game_sessions" ("mode", "status");
--> statement-breakpoint
CREATE INDEX "game_sessions_current_round_idx" ON "game_sessions" ("current_round_id");
--> statement-breakpoint
CREATE INDEX "game_sessions_racing_leaderboard_idx" ON "game_sessions" ("game_format", "status", "lap_count");
--> statement-breakpoint

CREATE TABLE "game_players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "guest_token" text,
  "display_name" text NOT NULL CHECK (char_length("display_name") BETWEEN 1 AND 30),
  "seat_order" integer NOT NULL CHECK ("seat_order" >= 0),
  "letters" text NOT NULL DEFAULT '',
  "failed_attempts" integer NOT NULL DEFAULT 0 CHECK ("failed_attempts" >= 0),
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'eliminated', 'left')),
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_players_identity_check" CHECK (("user_id" IS NULL) <> ("guest_token" IS NULL)),
  CONSTRAINT "game_players_game_seat_unique" UNIQUE ("game_id", "seat_order"),
  CONSTRAINT "game_players_game_id_id_unique" UNIQUE ("game_id", "id")
);
--> statement-breakpoint

CREATE UNIQUE INDEX "game_players_game_user_unique" ON "game_players" ("game_id", "user_id") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "game_players_game_guest_unique" ON "game_players" ("game_id", "guest_token") WHERE "guest_token" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX "game_players_guest_token_idx" ON "game_players" ("guest_token") WHERE "guest_token" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX "game_players_game_status_idx" ON "game_players" ("game_id", "status");
--> statement-breakpoint

CREATE INDEX "game_players_user_id_idx" ON "game_players" ("user_id") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_game_player_letters() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  word text;
BEGIN
  SELECT elimination_word INTO word FROM public.game_sessions WHERE id = NEW.game_id;
  IF word IS NULL THEN RAISE EXCEPTION 'game_sessions row not found for game_players row'; END IF;
  IF NOT starts_with(word, NEW.letters) THEN RAISE EXCEPTION 'letters must be a prefix of the elimination word'; END IF;
  IF NEW.letters <> '' AND upper(NEW.letters) <> NEW.letters THEN RAISE EXCEPTION 'letters must be uppercase'; END IF;
  IF NEW.failed_attempts <> char_length(NEW.letters) THEN RAISE EXCEPTION 'failed_attempts must equal the letter length'; END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE TRIGGER "game_players_letters_trigger"
BEFORE INSERT OR UPDATE ON "game_players"
FOR EACH ROW EXECUTE FUNCTION public.enforce_game_player_letters();
--> statement-breakpoint

CREATE TABLE "game_rounds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "sequence" integer NOT NULL CHECK ("sequence" > 0),
  "challenger_player_id" uuid,
  "trick_id" text,
  "trick_name_snapshot" text,
  "trick_description_snapshot" text,
  "trick_level" integer CHECK ("trick_level" IS NULL OR "trick_level" BETWEEN 1 AND 3),
  "level_selected_by_player_id" uuid,
  "spot_type" text NOT NULL,
  "spot_type_changed" boolean NOT NULL DEFAULT false,
  "spot_type_changed_by_player_id" uuid,
  "spot_type_snapshot" jsonb NOT NULL,
  "trick_compatibility_snapshot" jsonb,
  "eligible_player_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "catalog_trick_id" uuid REFERENCES "challenge_catalog_tricks"("id") ON DELETE SET NULL,
  "trick_source_id" text,
  "trick_discipline_snapshot" text,
  "blocked_reason" text,
  "challenger_result" text NOT NULL DEFAULT 'pending' CHECK ("challenger_result" IN ('pending', 'landed', 'failed')),
  "challenge_outcome" text CHECK ("challenge_outcome" IS NULL OR "challenge_outcome" IN ('established', 'failed_to_establish', 'resolved')),
  "lead_retained" boolean NOT NULL DEFAULT false,
  "challenger_attempted_at" timestamptz,
  "status" text NOT NULL DEFAULT 'verifying_location' CHECK ("status" IN ('verifying_location', 'selecting_spot_type', 'selecting_level', 'no_compatible_trick', 'challenge_open', 'collecting_results', 'resolved', 'paused', 'cancelled')),
  "required_response_player_ids" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz,
  CONSTRAINT "game_rounds_game_sequence_unique" UNIQUE ("game_id", "sequence"),
  CONSTRAINT "game_rounds_game_id_id_unique" UNIQUE ("game_id", "id"),
  CONSTRAINT "game_rounds_trick_discipline_check" CHECK ("trick_discipline_snapshot" IS NULL OR "trick_discipline_snapshot" IN ('roller', 'skateboard', 'bmx', 'scooter'))
);
--> statement-breakpoint

CREATE INDEX "game_rounds_game_status_idx" ON "game_rounds" ("game_id", "status");
--> statement-breakpoint

CREATE INDEX "game_rounds_catalog_trick_idx" ON "game_rounds" ("catalog_trick_id");
--> statement-breakpoint

CREATE TABLE "game_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "round_id" uuid NOT NULL REFERENCES "game_rounds"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "game_players"("id") ON DELETE CASCADE,
  "result" text NOT NULL CHECK ("result" IN ('landed', 'failed')),
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_attempts_round_player_unique" UNIQUE ("round_id", "player_id")
);
--> statement-breakpoint
CREATE INDEX "game_attempts_round_submitted_idx" ON "game_attempts" ("round_id", "submitted_at");
--> statement-breakpoint

CREATE TABLE "game_action_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "guest_token" text,
  "action" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "resulting_version" integer NOT NULL,
  "response_metadata" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_action_requests_identity_check" CHECK (("user_id" IS NULL) <> ("guest_token" IS NULL))
);
--> statement-breakpoint

CREATE UNIQUE INDEX "game_action_requests_scope_unique" ON "game_action_requests" ("game_id", "user_id", "action", "idempotency_key") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "game_action_requests_guest_scope_unique" ON "game_action_requests" ("game_id", "guest_token", "action", "idempotency_key") WHERE "guest_token" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX "game_action_requests_created_idx" ON "game_action_requests" ("created_at");
--> statement-breakpoint

CREATE INDEX "game_action_requests_user_action_key_idx" ON "game_action_requests" ("user_id", "action", "idempotency_key");
--> statement-breakpoint
CREATE INDEX "game_action_requests_game_action_created_idx" ON "game_action_requests" ("game_id", "action", "created_at");
--> statement-breakpoint

CREATE TABLE "game_location_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "round_id" uuid NOT NULL REFERENCES "game_rounds"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE RESTRICT,
  "verified_at" timestamptz,
  "distance_meters" integer,
  "accuracy_meters" integer,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'verified', 'rejected', 'expired', 'unavailable')),
  "rejection_reason" text CHECK ("rejection_reason" IS NULL OR "rejection_reason" IN ('too_far', 'low_accuracy', 'denied', 'unavailable')),
  "expires_at" timestamptz,
  CONSTRAINT "game_location_verifications_round_player_unique" UNIQUE ("round_id", "player_id")
);
--> statement-breakpoint

CREATE INDEX "game_location_verifications_game_round_idx" ON "game_location_verifications" ("game_id", "round_id");
--> statement-breakpoint

CREATE INDEX "game_location_verifications_player_verified_idx" ON "game_location_verifications" ("player_id", "verified_at");
--> statement-breakpoint

CREATE INDEX "game_location_verifications_spot_idx" ON "game_location_verifications" ("spot_id");
--> statement-breakpoint

CREATE TABLE "spot_challenge_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE RESTRICT,
  "discipline_slug" text NOT NULL,
  "game_name" text NOT NULL,
  "elimination_word" text NOT NULL,
  "scheduled_start_at" timestamptz NOT NULL,
  "started_at" timestamptz NOT NULL,
  "completed_at" timestamptz NOT NULL,
  "participant_count" integer NOT NULL CHECK ("participant_count" >= 2),
  "verified_participant_count" integer NOT NULL CHECK ("verified_participant_count" >= 2),
  "spot_types_used" jsonb NOT NULL,
  "round_count_by_spot_type" jsonb NOT NULL,
  "initial_spot_type" text NOT NULL,
  "final_spot_type" text NOT NULL,
  "winner_player_id" uuid NOT NULL,
  "status" text NOT NULL CHECK ("status" = 'completed'),
  CONSTRAINT "spot_challenge_records_game_unique" UNIQUE ("game_id"),
  CONSTRAINT "spot_challenge_records_verified_le_participant_check" CHECK ("verified_participant_count" <= "participant_count"),
  CONSTRAINT "spot_challenge_records_timestamps_check" CHECK ("started_at" <= "completed_at")
);
--> statement-breakpoint

CREATE INDEX "spot_challenge_records_spot_completed_idx" ON "spot_challenge_records" ("spot_id", "completed_at");
--> statement-breakpoint

CREATE TABLE "rider_stats" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "total_points" integer NOT NULL DEFAULT 0 CHECK ("total_points" >= 0),
  "games_played" integer NOT NULL DEFAULT 0 CHECK ("games_played" >= 0),
  "games_won" integer NOT NULL DEFAULT 0 CHECK ("games_won" >= 0),
  "tricks_landed" integer NOT NULL DEFAULT 0 CHECK ("tricks_landed" >= 0),
  "tricks_failed" integer NOT NULL DEFAULT 0 CHECK ("tricks_failed" >= 0),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "rider_score_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "round_id" uuid REFERENCES "game_rounds"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL CHECK ("event_type" IN ('challenger_landed', 'response_landed', 'winner_bonus')),
  "points" integer NOT NULL CHECK ("points" >= 0),
  "trick_level" integer CHECK ("trick_level" IS NULL OR "trick_level" BETWEEN 1 AND 3),
  "event_key" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX "rider_score_events_game_round_idx" ON "rider_score_events" ("game_id", "round_id");
--> statement-breakpoint

CREATE INDEX "rider_score_events_user_created_idx" ON "rider_score_events" ("user_id", "created_at");
--> statement-breakpoint

CREATE TABLE "game_race_laps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL,
  "lap_number" integer NOT NULL CHECK ("lap_number" BETWEEN 1 AND 20),
  "milliseconds" integer NOT NULL CHECK ("milliseconds" > 0),
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_race_laps_game_player_lap_unique" UNIQUE ("game_id", "player_id", "lap_number")
);
--> statement-breakpoint

CREATE INDEX "game_race_laps_game_lap_idx" ON "game_race_laps" ("game_id", "lap_number");
--> statement-breakpoint
CREATE INDEX "game_race_laps_game_player_lap_time_idx" ON "game_race_laps" ("game_id", "player_id", "lap_number", "milliseconds");
--> statement-breakpoint

CREATE INDEX "game_race_laps_player_time_idx" ON "game_race_laps" ("player_id", "milliseconds");
--> statement-breakpoint

CREATE TABLE "game_realtime_signals" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "version" integer NOT NULL CHECK ("version" >= 0),
  "signal_type" text NOT NULL CHECK ("signal_type" IN ('game_state_changed', 'game_completed', 'game_cancelled')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "game_realtime_signals_game_version_unique" UNIQUE ("game_id", "version")
);
--> statement-breakpoint

CREATE INDEX "game_realtime_signals_game_created_idx" ON "game_realtime_signals" ("game_id", "created_at");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.emit_game_realtime_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.version IS NOT DISTINCT FROM OLD.version THEN RETURN NEW; END IF;
  INSERT INTO public.game_realtime_signals (game_id, version, signal_type)
  VALUES (
    NEW.id,
    NEW.version,
    CASE NEW.status
      WHEN 'complete' THEN 'game_completed'
      WHEN 'cancelled' THEN 'game_cancelled'
      ELSE 'game_state_changed'
    END
  )
  ON CONFLICT (game_id, version) DO NOTHING;
  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE TRIGGER "game_sessions_realtime_signal_trigger"
AFTER UPDATE OF version ON "game_sessions"
FOR EACH ROW EXECUTE FUNCTION public.emit_game_realtime_signal();
--> statement-breakpoint

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK ("slug" = lower("slug") AND length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK ("slug" = lower("slug") AND length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
--> statement-breakpoint

CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" ("permission_id");
--> statement-breakpoint

CREATE TABLE "user_roles" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "granted_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);
--> statement-breakpoint

CREATE INDEX "user_roles_role_idx" ON "user_roles" ("role_id");
--> statement-breakpoint

CREATE TABLE "curator_country_scopes" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "country_code" text NOT NULL REFERENCES "countries"("iso2") ON DELETE RESTRICT,
  "granted_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "curator_country_scopes_pkey" PRIMARY KEY ("user_id", "country_code"),
  CONSTRAINT "curator_country_scopes_code_check" CHECK ("country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint

CREATE INDEX "curator_country_scopes_country_idx" ON "curator_country_scopes" ("country_code");
--> statement-breakpoint

CREATE TABLE "curator_discipline_scopes" (
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "granted_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "curator_discipline_scopes_pkey" PRIMARY KEY ("user_id", "discipline_slug"),
  CONSTRAINT "curator_discipline_scopes_slug_check" CHECK (length("discipline_slug") > 0)
);
--> statement-breakpoint

CREATE INDEX "curator_discipline_scopes_discipline_idx" ON "curator_discipline_scopes" ("discipline_slug");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.has_permission(permission_slug text, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = subject_user_id
       AND p.slug = permission_slug
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_game_participant(target_game_id uuid, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_players
     WHERE game_id = target_game_id
       AND user_id = subject_user_id
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_round_participant(target_round_id uuid, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.game_rounds r
     WHERE r.id = target_round_id
       AND public.is_game_participant(r.game_id, subject_user_id)
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.has_country_scope(target_country_code text, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.curator_country_scopes s
     WHERE s.user_id = subject_user_id
       AND s.country_code = target_country_code
       AND (
         subject_user_id = (select auth.uid())
         OR coalesce((select auth.role()), '') = 'service_role'
       )
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.has_discipline_scope(target_discipline_slug text, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.curator_discipline_scopes s
     WHERE s.user_id = subject_user_id
       AND s.discipline_slug = target_discipline_slug
       AND (
         subject_user_id = (select auth.uid())
         OR coalesce((select auth.role()), '') = 'service_role'
       )
  )
$$;
--> statement-breakpoint

ALTER TABLE "game_rounds"
  ADD CONSTRAINT "game_rounds_challenger_player_fk" FOREIGN KEY ("game_id", "challenger_player_id") REFERENCES "game_players" ("game_id", "id") ON DELETE SET NULL ("challenger_player_id"),
  ADD CONSTRAINT "game_rounds_level_selected_fk" FOREIGN KEY ("game_id", "level_selected_by_player_id") REFERENCES "game_players" ("game_id", "id") ON DELETE SET NULL ("level_selected_by_player_id"),
  ADD CONSTRAINT "game_rounds_spot_type_changed_fk" FOREIGN KEY ("game_id", "spot_type_changed_by_player_id") REFERENCES "game_players" ("game_id", "id") ON DELETE SET NULL ("spot_type_changed_by_player_id");
--> statement-breakpoint

ALTER TABLE "game_location_verifications"
  ADD CONSTRAINT "game_location_verifications_player_game_fk" FOREIGN KEY ("game_id", "player_id") REFERENCES "game_players" ("game_id", "id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "spot_challenge_records"
  ADD CONSTRAINT "spot_challenge_records_winner_player_fk" FOREIGN KEY ("game_id", "winner_player_id") REFERENCES "game_players" ("game_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint

ALTER TABLE "rider_score_events"
  ADD CONSTRAINT "rider_score_events_round_game_fk" FOREIGN KEY ("game_id", "round_id") REFERENCES "game_rounds" ("game_id", "id") ON DELETE SET NULL ("round_id");
--> statement-breakpoint

ALTER TABLE "game_race_laps"
  ADD CONSTRAINT "game_race_laps_player_game_fk" FOREIGN KEY ("game_id", "player_id") REFERENCES "game_players" ("game_id", "id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "game_sessions"
  ADD CONSTRAINT "game_sessions_winner_player_fk" FOREIGN KEY ("id", "winner_player_id") REFERENCES "game_players" ("game_id", "id") ON DELETE SET NULL ("winner_player_id"),
  ADD CONSTRAINT "game_sessions_current_round_fk" FOREIGN KEY ("id", "current_round_id") REFERENCES "game_rounds" ("game_id", "id") ON DELETE SET NULL ("current_round_id"),
  ADD CONSTRAINT "game_sessions_current_challenger_player_fk" FOREIGN KEY ("id", "current_challenger_player_id") REFERENCES "game_players" ("game_id", "id") ON DELETE SET NULL ("current_challenger_player_id");
--> statement-breakpoint

ALTER TABLE "game_sessions"
  ADD CONSTRAINT "game_sessions_available_spot_types_shape_check" CHECK (public.jsonb_is_spot_type_snapshot_array("available_spot_types")),
  ADD CONSTRAINT "game_sessions_rotation_order_shape_check" CHECK (public.jsonb_is_unique_uuid_array("rotation_order")),
  ADD CONSTRAINT "game_sessions_initial_spot_type_snapshot_check" CHECK ("available_spot_types" @> jsonb_build_array(jsonb_build_object('slug', "initial_spot_type"))),
  ADD CONSTRAINT "game_sessions_next_spot_type_snapshot_check" CHECK ("available_spot_types" @> jsonb_build_array(jsonb_build_object('slug', "next_spot_type")));
--> statement-breakpoint

ALTER TABLE "game_rounds"
  ADD CONSTRAINT "game_rounds_spot_type_snapshot_shape_check" CHECK (public.jsonb_is_spot_type_snapshot_array("spot_type_snapshot")),
  ADD CONSTRAINT "game_rounds_trick_compatibility_shape_check" CHECK ("trick_compatibility_snapshot" IS NULL OR public.jsonb_is_unique_nonempty_text_array("trick_compatibility_snapshot")),
  ADD CONSTRAINT "game_rounds_eligible_player_ids_shape_check" CHECK (public.jsonb_is_unique_uuid_array("eligible_player_ids")),
  ADD CONSTRAINT "game_rounds_required_response_player_ids_shape_check" CHECK (public.jsonb_is_unique_uuid_array("required_response_player_ids"));
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_game_session_catalog_definition() RETURNS trigger
LANGUAGE plpgsql AS $$
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
END
$$;
--> statement-breakpoint

CREATE TRIGGER "game_session_catalog_definition_trigger"
BEFORE INSERT OR UPDATE ON "game_sessions"
FOR EACH ROW EXECUTE FUNCTION public.enforce_game_session_catalog_definition();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_immutable_game_definition() RETURNS trigger
LANGUAGE plpgsql AS $$
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
END
$$;
--> statement-breakpoint

CREATE TRIGGER "game_sessions_immutable_definition_trigger"
BEFORE UPDATE ON "game_sessions"
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_game_definition();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.reject_immutable_catalog_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Challenge catalog snapshots are immutable';
END
$$;
--> statement-breakpoint

CREATE TRIGGER "challenge_catalogs_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_catalogs"
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_catalog_mutation();
--> statement-breakpoint

CREATE TRIGGER "challenge_catalog_tricks_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_catalog_tricks"
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_catalog_mutation();
--> statement-breakpoint

CREATE TRIGGER "challenge_trick_spot_types_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_trick_spot_types"
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_catalog_mutation();
--> statement-breakpoint


CREATE TABLE "content_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "entity_type" text NOT NULL CHECK ("entity_type" IN ('spot', 'event', 'trick')),
  "entity_id" uuid NOT NULL,
  "discipline_slug" text REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "action" text NOT NULL CHECK ("action" IN ('create', 'update', 'delete')),
  "before" jsonb,
  "after" jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "content_audit_log_before_after_check" CHECK (
    ("action" = 'create' AND "before" IS NULL AND "after" IS NOT NULL) OR
    ("action" = 'update' AND "before" IS NOT NULL AND "after" IS NOT NULL) OR
    ("action" = 'delete' AND "before" IS NOT NULL AND "after" IS NULL)
  )
);
--> statement-breakpoint

CREATE INDEX "content_audit_log_entity_idx" ON "content_audit_log" ("entity_type", "entity_id", "created_at");
--> statement-breakpoint

CREATE INDEX "content_audit_log_actor_idx" ON "content_audit_log" ("actor_id", "created_at");
--> statement-breakpoint

CREATE INDEX "content_audit_log_discipline_idx" ON "content_audit_log" ("discipline_slug", "created_at");
--> statement-breakpoint

CREATE TABLE "spot_weather_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE RESTRICT,
  "game_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "reporter_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "forecast_icon" text NOT NULL CHECK ("forecast_icon" IN ('sunny','partly_cloudy_day','cloudy','rain','snow')),
  "observed_icon" text NOT NULL CHECK ("observed_icon" IN ('sunny','partly_cloudy_day','cloudy','rain','snow')),
  "confirmed" boolean NOT NULL,
  "forecast_snapshot" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "spot_weather_reports_game_unique" UNIQUE ("game_id")
);
--> statement-breakpoint

CREATE INDEX "spot_weather_reports_spot_created_idx" ON "spot_weather_reports" ("spot_id", "created_at");
--> statement-breakpoint

CREATE INDEX "spot_weather_reports_game_idx" ON "spot_weather_reports" ("game_id");
--> statement-breakpoint

UPDATE "trick_definition_spot_types" SET "spot_type_slug" = lower("spot_type_slug") WHERE "spot_type_slug" <> lower("spot_type_slug");
--> statement-breakpoint

UPDATE "challenge_trick_spot_types" SET "spot_type_slug" = lower("spot_type_slug") WHERE "spot_type_slug" <> lower("spot_type_slug");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_spot_discipline_presence()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_spot_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'spots' THEN
    target_spot_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    target_spot_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.spot_id ELSE NEW.spot_id END;
  END IF;
  IF EXISTS (SELECT 1 FROM public.spots WHERE id = target_spot_id)
     AND NOT EXISTS (
       SELECT 1
         FROM public.spot_disciplines
        WHERE spot_id = target_spot_id
     ) THEN
    RAISE EXCEPTION 'A spot must have at least one sport discipline';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_event_discipline_presence()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_event_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'sport_events' THEN
    target_event_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    target_event_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.event_id ELSE NEW.event_id END;
  END IF;
  IF EXISTS (SELECT 1 FROM public.sport_events WHERE id = target_event_id)
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_disciplines
        WHERE event_id = target_event_id
     ) THEN
    RAISE EXCEPTION 'A sport event must have at least one sport discipline';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER spots_require_discipline
  AFTER INSERT OR UPDATE ON public.spots
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_spot_discipline_presence();
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER spot_disciplines_require_parent_discipline
  AFTER INSERT OR UPDATE OR DELETE ON public.spot_disciplines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_spot_discipline_presence();
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER sport_events_require_discipline
  AFTER INSERT OR UPDATE ON public.sport_events
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_discipline_presence();
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER event_disciplines_require_parent_discipline
  AFTER INSERT OR UPDATE OR DELETE ON public.event_disciplines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_discipline_presence();
--> statement-breakpoint

ALTER TABLE "content_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON TABLE "content_audit_log" FROM anon, authenticated;
--> statement-breakpoint

ALTER TABLE "curator_country_scopes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "curator_discipline_scopes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON TABLE "curator_country_scopes" FROM anon, authenticated;
--> statement-breakpoint

REVOKE ALL ON TABLE "curator_discipline_scopes" FROM anon, authenticated;
--> statement-breakpoint

ALTER TABLE "spot_weather_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "regions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "countries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "spot_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sport_disciplines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_tiers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "spots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sport_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "external_posts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "spot_disciplines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_disciplines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "spot_type_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "saved_spots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "verified_spots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "trick_definitions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "trick_definition_spot_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "trick_catalog_states" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "challenge_catalogs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "challenge_catalog_tricks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "challenge_trick_spot_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_players" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_rounds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_action_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_location_verifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "spot_challenge_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rider_stats" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rider_score_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_race_laps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_realtime_signals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "regions_select_public" ON "regions" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "countries_select_public" ON "countries" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "spot_types_select_public" ON "spot_types" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "sport_disciplines_select_public" ON "sport_disciplines" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "event_tiers_select_public" ON "event_tiers" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "profiles_select_self" ON "profiles" FOR SELECT TO authenticated USING ((select auth.uid()) = id);
--> statement-breakpoint
CREATE POLICY "profiles_insert_self" ON "profiles" FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
--> statement-breakpoint
CREATE POLICY "profiles_update_self" ON "profiles" FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);
--> statement-breakpoint
CREATE POLICY "spots_select_public" ON "spots" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "spots_insert_owner_or_curator" ON "spots" FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = created_by OR public.has_permission('content.write', (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "spots_update_owner_or_curator" ON "spots" FOR UPDATE TO authenticated USING ((select auth.uid()) = created_by OR public.has_permission('content.write', (select auth.uid()))) WITH CHECK ((select auth.uid()) = created_by OR public.has_permission('content.write', (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "spots_delete_owner_or_curator" ON "spots" FOR DELETE TO authenticated USING ((select auth.uid()) = created_by OR public.has_permission('content.write', (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "sport_events_select_public" ON "sport_events" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "external_posts_select_published" ON "external_posts" FOR SELECT TO anon, authenticated USING (published = true);
--> statement-breakpoint
CREATE POLICY "spot_disciplines_select_public" ON "spot_disciplines" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "spot_disciplines_insert_owner_or_curator" ON "spot_disciplines" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.spots s WHERE s.id = spot_id AND (s.created_by = (select auth.uid()) OR public.has_permission('content.write', (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "spot_disciplines_delete_owner_or_curator" ON "spot_disciplines" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.spots s WHERE s.id = spot_id AND (s.created_by = (select auth.uid()) OR public.has_permission('content.write', (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "event_disciplines_select_public" ON "event_disciplines" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "spot_type_assignments_select_public" ON "spot_type_assignments" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "spot_type_assignments_insert_owner_or_curator" ON "spot_type_assignments" FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.spots s WHERE s.id = spot_id AND (s.created_by = (select auth.uid()) OR public.has_permission('content.write', (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "spot_type_assignments_delete_owner_or_curator" ON "spot_type_assignments" FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.spots s WHERE s.id = spot_id AND (s.created_by = (select auth.uid()) OR public.has_permission('content.write', (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "saved_spots_select_owner" ON "saved_spots" FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
--> statement-breakpoint
CREATE POLICY "saved_spots_insert_owner" ON "saved_spots" FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
--> statement-breakpoint
CREATE POLICY "saved_spots_delete_owner" ON "saved_spots" FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
--> statement-breakpoint
CREATE POLICY "verified_spots_select_owner" ON "verified_spots" FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
--> statement-breakpoint
CREATE POLICY "verified_spots_insert_owner" ON "verified_spots" FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
--> statement-breakpoint
CREATE POLICY "verified_spots_delete_owner" ON "verified_spots" FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
--> statement-breakpoint
CREATE POLICY "trick_definitions_select_public" ON "trick_definitions" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "trick_definition_spot_types_select_public" ON "trick_definition_spot_types" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "trick_catalog_states_select_public" ON "trick_catalog_states" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "challenge_catalogs_select_public" ON "challenge_catalogs" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "challenge_catalog_tricks_select_public" ON "challenge_catalog_tricks" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "challenge_trick_spot_types_select_public" ON "challenge_trick_spot_types" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "game_sessions_select_participant" ON "game_sessions" FOR SELECT TO authenticated USING (created_by = (select auth.uid()) OR public.is_game_participant("game_sessions".id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "game_players_select_participant" ON "game_players" FOR SELECT TO authenticated USING (public.is_game_participant("game_players".game_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "game_rounds_select_participant" ON "game_rounds" FOR SELECT TO authenticated USING (public.is_game_participant("game_rounds".game_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "game_attempts_select_participant" ON "game_attempts" FOR SELECT TO authenticated USING (public.is_round_participant("game_attempts".round_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "game_action_requests_select_participant" ON "game_action_requests" FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
--> statement-breakpoint
CREATE POLICY "game_location_verifications_select_participant" ON "game_location_verifications" FOR SELECT TO authenticated USING (public.is_game_participant("game_location_verifications".game_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "spot_challenge_records_select_authenticated" ON "spot_challenge_records" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "rider_stats_select_self" ON "rider_stats" FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
--> statement-breakpoint
CREATE POLICY "rider_score_events_select_self" ON "rider_score_events" FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
--> statement-breakpoint
CREATE POLICY "game_race_laps_select_participant" ON "game_race_laps" FOR SELECT TO authenticated USING (public.is_game_participant("game_race_laps".game_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "game_realtime_signals_select_participant" ON "game_realtime_signals" FOR SELECT TO authenticated USING (public.is_game_participant("game_realtime_signals".game_id, (select auth.uid())) OR EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = "game_realtime_signals".game_id AND s.created_by = (select auth.uid())));
--> statement-breakpoint

REVOKE SELECT ("guest_token") ON public."game_players" FROM anon, authenticated;
--> statement-breakpoint

DROP POLICY IF EXISTS "spot_images_select_owner" ON "storage"."objects";
--> statement-breakpoint
DROP POLICY IF EXISTS "spot_images_insert_owner" ON "storage"."objects";
--> statement-breakpoint
DROP POLICY IF EXISTS "spot_images_update_owner" ON "storage"."objects";
--> statement-breakpoint
DROP POLICY IF EXISTS "spot_images_delete_owner" ON "storage"."objects";
--> statement-breakpoint
CREATE POLICY "spot_images_select" ON "storage"."objects" FOR SELECT TO authenticated USING (bucket_id = 'spot-images' AND EXISTS (SELECT 1 FROM public.spots s WHERE s.id::text = (storage.foldername(name))[2] AND (s.created_by = (select auth.uid()) OR public.has_permission('media.manage', (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "spot_images_insert" ON "storage"."objects" FOR INSERT TO authenticated WITH CHECK (bucket_id = 'spot-images' AND EXISTS (SELECT 1 FROM public.spots s WHERE s.id::text = (storage.foldername(name))[2] AND (s.created_by = (select auth.uid()) OR public.has_permission('media.manage', (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "spot_images_update" ON "storage"."objects" FOR UPDATE TO authenticated USING (bucket_id = 'spot-images' AND EXISTS (SELECT 1 FROM public.spots s WHERE s.id::text = (storage.foldername(name))[2] AND (s.created_by = (select auth.uid()) OR public.has_permission('media.manage', (select auth.uid()))))) WITH CHECK (bucket_id = 'spot-images' AND EXISTS (SELECT 1 FROM public.spots s WHERE s.id::text = (storage.foldername(name))[2] AND (s.created_by = (select auth.uid()) OR public.has_permission('media.manage', (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "spot_images_delete" ON "storage"."objects" FOR DELETE TO authenticated USING (bucket_id = 'spot-images' AND EXISTS (SELECT 1 FROM public.spots s WHERE s.id::text = (storage.foldername(name))[2] AND (s.created_by = (select auth.uid()) OR public.has_permission('media.manage', (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "event_images_select" ON "storage"."objects" FOR SELECT TO authenticated USING (bucket_id = 'event-images' AND public.has_permission('media.manage', (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_images_insert" ON "storage"."objects" FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-images' AND public.has_permission('media.manage', (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_images_update" ON "storage"."objects" FOR UPDATE TO authenticated USING (bucket_id = 'event-images' AND public.has_permission('media.manage', (select auth.uid()))) WITH CHECK (bucket_id = 'event-images' AND public.has_permission('media.manage', (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_images_delete" ON "storage"."objects" FOR DELETE TO authenticated USING (bucket_id = 'event-images' AND public.has_permission('media.manage', (select auth.uid())));
--> statement-breakpoint

DO $$
DECLARE
  relation_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'supabase_realtime publication does not exist';
  END IF;

  FOR relation_name IN
    SELECT format('%I.%I', n.nspname, c.relname)
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid = p.oid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE p.pubname = 'supabase_realtime'
       AND n.nspname = 'public'
       AND c.relname = ANY (ARRAY[
         'game_sessions',
         'game_players',
         'game_rounds',
         'game_attempts',
         'game_location_verifications'
       ])
  LOOP
    EXECUTE format(
      'ALTER PUBLICATION %I DROP TABLE %s',
      'supabase_realtime',
      relation_name
    );
  END LOOP;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid = p.oid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE p.pubname = 'supabase_realtime'
       AND n.nspname = 'public'
       AND c.relname = 'game_realtime_signals'
  ) THEN
    EXECUTE 'ALTER PUBLICATION "supabase_realtime" ADD TABLE public.game_realtime_signals';
  END IF;
END
$$;
