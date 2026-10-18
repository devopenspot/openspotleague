-- League / events redesign (0026).
-- Drop-and-recreate of the events section: sport_events becomes the unified
-- entity for editorial ("seed") and user-created ("community") league events,
-- and the competition/billing/plumbing tables are introduced.
-- Rows in the replaced tables are disposable by design (see
-- .agents/specs/league/data-model.spec.md); applied files stay immutable.

DROP POLICY IF EXISTS "event_disciplines_select_public" ON "event_disciplines";
--> statement-breakpoint

DROP POLICY IF EXISTS "sport_events_select_public" ON "sport_events";
--> statement-breakpoint

DROP POLICY IF EXISTS "event_tiers_select_public" ON "event_tiers";
--> statement-breakpoint

DROP TRIGGER IF EXISTS event_disciplines_require_parent_discipline ON "event_disciplines";
--> statement-breakpoint

DROP TRIGGER IF EXISTS sport_events_require_discipline ON "sport_events";
--> statement-breakpoint

DROP FUNCTION IF EXISTS public.enforce_event_discipline_presence();
--> statement-breakpoint

DROP TABLE IF EXISTS "event_disciplines";
--> statement-breakpoint

DROP TABLE IF EXISTS "sport_events";
--> statement-breakpoint

DROP TABLE IF EXISTS "event_tiers";
--> statement-breakpoint

CREATE TABLE "event_plans" (
  "slug" text PRIMARY KEY,
  "name" text NOT NULL CHECK (length("name") > 0),
  "description" text NOT NULL DEFAULT '',
  "price_cents" integer NOT NULL CHECK ("price_cents" >= 0),
  "currency" text NOT NULL DEFAULT 'USD' CHECK ("currency" ~ '^[A-Z]{3}$'),
  "max_riders" integer NOT NULL CHECK ("max_riders" > 0),
  "max_judges" integer NOT NULL CHECK ("max_judges" >= 0),
  "max_organizers" integer NOT NULL CHECK ("max_organizers" >= 1),
  "monthly_event_limit" integer NOT NULL CHECK ("monthly_event_limit" > 0),
  "is_default" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX "event_plans_default_unique" ON "event_plans" ("is_default") WHERE "is_default" AND "active";
--> statement-breakpoint

CREATE TABLE "event_categories" (
  "slug" text PRIMARY KEY,
  "name" text NOT NULL CHECK (length("name") > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0)
);
--> statement-breakpoint

CREATE INDEX "event_categories_sort_order_idx" ON "event_categories" ("sort_order");
--> statement-breakpoint

CREATE TABLE "sport_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE CHECK (length("slug") > 0),
  "name" text NOT NULL CHECK (length("name") > 0),
  "short_name" text,
  "description" text NOT NULL DEFAULT '',
  "origin" text NOT NULL DEFAULT 'community' CHECK ("origin" IN ('seed', 'community')),
  "visibility" text NOT NULL DEFAULT 'unlisted' CHECK ("visibility" IN ('public', 'unlisted')),
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'registration_open', 'registration_closed', 'scheduled', 'live', 'completed', 'cancelled')),
  "timezone" text NOT NULL CHECK (length("timezone") > 0),
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz,
  "registration_closes_at" timestamptz,
  "schedule_published_at" timestamptz,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "cancelled_at" timestamptz,
  "results_published_at" timestamptz,
  "city" text NOT NULL CHECK (length("city") > 0),
  "city_slug" text,
  "address" text,
  "country_code" text NOT NULL REFERENCES "countries"("iso2") ON DELETE RESTRICT,
  "venue" text,
  "location" geography(Point, 4326),
  "spot_id" uuid REFERENCES "spots"("id") ON DELETE SET NULL,
  "spot_name_snapshot" text,
  "spot_city_snapshot" text,
  "category_slug" text NOT NULL DEFAULT 'local-event' REFERENCES "event_categories"("slug") ON DELETE RESTRICT,
  "plan_slug" text NOT NULL DEFAULT 'free' REFERENCES "event_plans"("slug") ON DELETE RESTRICT,
  "featured" boolean NOT NULL DEFAULT false,
  "image_url" text NOT NULL CHECK (length("image_url") > 0),
  "url" text,
  "instagram" text,
  "youtube" text,
  "version" integer NOT NULL DEFAULT 0 CHECK ("version" >= 0),
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "sport_events_end_at_after_start_at_check" CHECK ("end_at" IS NULL OR "end_at" >= "start_at")
);
--> statement-breakpoint

CREATE INDEX "sport_events_country_code_idx" ON "sport_events" ("country_code");
--> statement-breakpoint

CREATE INDEX "sport_events_category_slug_idx" ON "sport_events" ("category_slug");
--> statement-breakpoint

CREATE INDEX "sport_events_plan_slug_idx" ON "sport_events" ("plan_slug");
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

CREATE INDEX "sport_events_origin_idx" ON "sport_events" ("origin");
--> statement-breakpoint

CREATE INDEX "sport_events_visibility_idx" ON "sport_events" ("visibility");
--> statement-breakpoint

CREATE INDEX "sport_events_status_idx" ON "sport_events" ("status");
--> statement-breakpoint

CREATE INDEX "sport_events_featured_idx" ON "sport_events" ("featured");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS sport_events_name_trgm_idx ON sport_events USING gin (lower(name) gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS sport_events_city_trgm_idx ON sport_events USING gin (lower(city) gin_trgm_ops);
--> statement-breakpoint

CREATE TABLE "event_disciplines" (
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  CONSTRAINT "event_disciplines_pkey" PRIMARY KEY ("event_id", "discipline_slug")
);
--> statement-breakpoint

CREATE INDEX "event_disciplines_discipline_idx" ON "event_disciplines" ("discipline_slug");
--> statement-breakpoint

CREATE INDEX "event_disciplines_discipline_event_idx" ON "event_disciplines" ("discipline_slug", "event_id");
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

CREATE TABLE "user_event_plans" (
  "user_id" uuid PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "plan_slug" text NOT NULL REFERENCES "event_plans"("slug") ON DELETE RESTRICT,
  "source" text NOT NULL CHECK ("source" IN ('payment', 'admin_grant')),
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'revoked')),
  "granted_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "granted_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX "user_event_plans_plan_slug_idx" ON "user_event_plans" ("plan_slug");
--> statement-breakpoint

CREATE TABLE "event_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "plan_slug" text NOT NULL REFERENCES "event_plans"("slug") ON DELETE RESTRICT,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'paid', 'refunded', 'comped', 'failed')),
  "amount_cents" integer NOT NULL CHECK ("amount_cents" >= 0),
  "currency" text NOT NULL CHECK ("currency" ~ '^[A-Z]{3}$'),
  "provider" text NOT NULL DEFAULT 'manual' CHECK (length("provider") > 0),
  "provider_reference" text,
  "payer_user_id" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "marked_paid_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "paid_at" timestamptz,
  "refunded_at" timestamptz,
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX "event_payments_event_idx" ON "event_payments" ("event_id");
--> statement-breakpoint

CREATE INDEX "event_payments_status_created_idx" ON "event_payments" ("status", "created_at");
--> statement-breakpoint

CREATE UNIQUE INDEX "event_payments_event_active_unique" ON "event_payments" ("event_id") WHERE "status" IN ('pending', 'paid', 'comped');
--> statement-breakpoint

CREATE TABLE "event_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "role" text NOT NULL CHECK ("role" IN ('organizer', 'judge', 'rider')),
  "code" text NOT NULL UNIQUE CHECK (length("code") > 0),
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "expires_at" timestamptz,
  "max_uses" integer CHECK ("max_uses" IS NULL OR "max_uses" > 0),
  "use_count" integer NOT NULL DEFAULT 0 CHECK ("use_count" >= 0),
  "revoked_at" timestamptz,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "event_invites_use_count_within_max_check" CHECK ("max_uses" IS NULL OR "use_count" <= "max_uses")
);
--> statement-breakpoint

CREATE INDEX "event_invites_event_role_idx" ON "event_invites" ("event_id", "role");
--> statement-breakpoint

CREATE TABLE "event_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "role" text NOT NULL CHECK ("role" IN ('main_organizer', 'organizer', 'judge', 'rider')),
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'removed', 'withdrawn')),
  "joined_via_invite_id" uuid REFERENCES "event_invites"("id") ON DELETE SET NULL,
  "added_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "removed_at" timestamptz,
  "removed_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "event_memberships_event_user_active_unique" ON "event_memberships" ("event_id", "user_id") WHERE "status" = 'active';
--> statement-breakpoint

CREATE UNIQUE INDEX "event_memberships_main_organizer_unique" ON "event_memberships" ("event_id") WHERE "role" = 'main_organizer' AND "status" = 'active';
--> statement-breakpoint

CREATE INDEX "event_memberships_user_status_idx" ON "event_memberships" ("user_id", "status");
--> statement-breakpoint

CREATE INDEX "event_memberships_event_role_status_idx" ON "event_memberships" ("event_id", "role", "status");
--> statement-breakpoint

CREATE TABLE "event_scoring_criteria" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "key" text NOT NULL CHECK ("key" = lower("key") AND length("key") > 0),
  "label" text NOT NULL CHECK (length("label") > 0),
  "weight" numeric(6, 3) NOT NULL DEFAULT 1 CHECK ("weight" > 0),
  "max_score" numeric(6, 2) NOT NULL CHECK ("max_score" > 0),
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  CONSTRAINT "event_scoring_criteria_event_key_unique" UNIQUE ("event_id", "key")
);
--> statement-breakpoint

CREATE TABLE "event_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "membership_id" uuid NOT NULL REFERENCES "event_memberships"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "stage" text NOT NULL DEFAULT 'final' CHECK (length("stage") > 0),
  "sequence" integer NOT NULL CHECK ("sequence" > 0),
  "status" text NOT NULL DEFAULT 'scheduled' CHECK ("status" IN ('scheduled', 'judging', 'scored', 'skipped', 'completed')),
  "scheduled_at" timestamptz,
  "window_started_at" timestamptz,
  "window_ends_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_runs_window_after_start_check" CHECK ("window_ends_at" IS NULL OR ("window_started_at" IS NOT NULL AND "window_ends_at" > "window_started_at"))
);
--> statement-breakpoint

CREATE UNIQUE INDEX "event_runs_event_membership_stage_unique" ON "event_runs" ("event_id", "membership_id", "stage");
--> statement-breakpoint

CREATE UNIQUE INDEX "event_runs_event_stage_sequence_unique" ON "event_runs" ("event_id", "stage", "sequence");
--> statement-breakpoint

CREATE INDEX "event_runs_event_status_idx" ON "event_runs" ("event_id", "status");
--> statement-breakpoint

CREATE TABLE "event_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "run_id" uuid NOT NULL REFERENCES "event_runs"("id") ON DELETE CASCADE,
  "judge_user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "scores" jsonb NOT NULL CHECK (jsonb_typeof("scores") = 'object'),
  "total" numeric(8, 2) NOT NULL CHECK ("total" >= 0),
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_scores_run_judge_unique" UNIQUE ("run_id", "judge_user_id")
);
--> statement-breakpoint

CREATE INDEX "event_scores_event_idx" ON "event_scores" ("event_id");
--> statement-breakpoint

CREATE TABLE "event_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") on delete CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "run_id" uuid REFERENCES "event_runs"("id") ON DELETE SET NULL,
  "total_score" numeric(8, 2) NOT NULL CHECK ("total_score" >= 0),
  "rank" integer NOT NULL CHECK ("rank" > 0),
  "points_awarded" integer NOT NULL CHECK ("points_awarded" >= 0),
  "published_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_results_event_user_unique" UNIQUE ("event_id", "user_id"),
  CONSTRAINT "event_results_event_rank_unique" UNIQUE ("event_id", "rank")
);
--> statement-breakpoint

CREATE INDEX "event_results_user_published_idx" ON "event_results" ("user_id", "published_at");
--> statement-breakpoint

CREATE TABLE "event_points_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "event_key" text NOT NULL UNIQUE CHECK (length("event_key") > 0),
  "event_type" text NOT NULL CHECK ("event_type" IN ('event_attended', 'event_rank_bonus')),
  "points" integer NOT NULL CHECK ("points" >= 0),
  "rank" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX "event_points_ledger_user_created_idx" ON "event_points_ledger" ("user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "event_points_ledger_event_idx" ON "event_points_ledger" ("event_id");
--> statement-breakpoint

ALTER TABLE "rider_stats"
  ADD COLUMN "events_attended" integer NOT NULL DEFAULT 0,
  ADD COLUMN "events_won" integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT "rider_stats_events_attended_check" CHECK ("events_attended" >= 0),
  ADD CONSTRAINT "rider_stats_events_won_check" CHECK ("events_won" >= 0);
--> statement-breakpoint

CREATE TABLE "event_action_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "resulting_version" integer NOT NULL CHECK ("resulting_version" >= 0),
  "response_metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX "event_action_requests_scope_unique" ON "event_action_requests" ("event_id", "user_id", "action", "idempotency_key");
--> statement-breakpoint

CREATE INDEX "event_action_requests_created_idx" ON "event_action_requests" ("created_at");
--> statement-breakpoint

CREATE INDEX "event_action_requests_user_action_key_idx" ON "event_action_requests" ("user_id", "action", "idempotency_key");
--> statement-breakpoint

CREATE INDEX "event_action_requests_event_action_created_idx" ON "event_action_requests" ("event_id", "action", "created_at");
--> statement-breakpoint

CREATE TABLE "event_realtime_signals" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "version" integer NOT NULL CHECK ("version" >= 0),
  "signal_type" text NOT NULL CHECK ("signal_type" IN ('event_state_changed', 'registration_changed', 'schedule_published', 'run_started', 'score_submitted', 'results_published', 'event_cancelled')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX "event_realtime_signals_event_version_unique" ON "event_realtime_signals" ("event_id", "version");
--> statement-breakpoint

CREATE INDEX "event_realtime_signals_event_created_idx" ON "event_realtime_signals" ("event_id", "created_at");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_event_participant(target_event_id uuid, subject_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.emit_event_realtime_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
END
$$;
--> statement-breakpoint

CREATE TRIGGER "sport_events_realtime_signal_trigger"
AFTER UPDATE OF version ON "sport_events"
FOR EACH ROW EXECUTE FUNCTION public.emit_event_realtime_signal();
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
       AND c.relname = 'event_realtime_signals'
  ) THEN
    EXECUTE 'ALTER PUBLICATION "supabase_realtime" ADD TABLE public.event_realtime_signals';
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "event_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sport_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_disciplines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_event_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_scoring_criteria" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_scores" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_results" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_points_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_action_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_realtime_signals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON TABLE "event_plans" FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE "user_event_plans" FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE "event_payments" FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE "event_invites" FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE "event_action_requests" FROM anon, authenticated;
--> statement-breakpoint

CREATE POLICY "event_categories_select_public" ON "event_categories" FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "sport_events_select_public" ON "sport_events" FOR SELECT TO anon, authenticated USING ("visibility" = 'public' OR "created_by" = (select auth.uid()) OR public.is_event_participant("sport_events".id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_disciplines_select_public" ON "event_disciplines" FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.sport_events e WHERE e.id = "event_disciplines".event_id AND (e."visibility" = 'public' OR e."created_by" = (select auth.uid()) OR public.is_event_participant(e.id, (select auth.uid())))));
--> statement-breakpoint
CREATE POLICY "event_memberships_select_participant" ON "event_memberships" FOR SELECT TO authenticated USING (public.is_event_participant("event_memberships".event_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_scoring_criteria_select_participant" ON "event_scoring_criteria" FOR SELECT TO authenticated USING (public.is_event_participant("event_scoring_criteria".event_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_runs_select_participant" ON "event_runs" FOR SELECT TO authenticated USING (public.is_event_participant("event_runs".event_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_scores_select_participant" ON "event_scores" FOR SELECT TO authenticated USING (public.is_event_participant("event_scores".event_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_results_select_participant" ON "event_results" FOR SELECT TO authenticated USING (public.is_event_participant("event_results".event_id, (select auth.uid())));
--> statement-breakpoint
CREATE POLICY "event_points_ledger_select_self" ON "event_points_ledger" FOR SELECT TO authenticated USING ("user_id" = (select auth.uid()));
--> statement-breakpoint
CREATE POLICY "event_realtime_signals_select_participant" ON "event_realtime_signals" FOR SELECT TO authenticated USING (public.is_event_participant("event_realtime_signals".event_id, (select auth.uid())));
--> statement-breakpoint

INSERT INTO "event_categories" ("slug", "name", "sort_order") VALUES
  ('world-tour', 'World Tour', 1),
  ('championship', 'Championship', 2),
  ('festival', 'Festival', 3),
  ('federation', 'Federation', 4),
  ('local-event', 'Local Event', 5)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

INSERT INTO "event_plans" ("slug", "name", "description", "price_cents", "currency", "max_riders", "max_judges", "max_organizers", "monthly_event_limit", "is_default", "active", "sort_order") VALUES
  ('free', 'Free', 'Community events: 1 organizer (judges implicitly), up to 3 riders.', 0, 'USD', 3, 0, 1, 8, true, true, 1),
  ('starter', 'Starter', 'Up to 13 riders, 2 judges and 2 organizers.', 500, 'USD', 13, 2, 2, 21, false, true, 2),
  ('pro', 'Pro', 'Up to 55 riders, 4 judges and 5 organizers.', 2100, 'USD', 55, 4, 5, 21, false, true, 3)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
