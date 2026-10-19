import fs from "node:fs"
import path from "node:path"

function build() {
  const generatedPath = path.join(process.cwd(), "supabase", "migrations", "0001_spotty_scrambler.sql")
  if (!fs.existsSync(generatedPath)) {
    throw new Error("Missing 0001_spotty_scrambler.sql - run drizzle-kit generate first")
  }

  const generatedContent = fs.readFileSync(generatedPath, "utf-8")
  const generatedStatements = generatedContent
    .split("--> statement-breakpoint")
    .map(s => s.trim())
    .filter(Boolean)

  // Filter out statements that create auth schema or auth.users (provided natively by Supabase)
  const filteredDrizzleStatements = generatedStatements.filter(s => {
    if (s.startsWith('CREATE SCHEMA "auth"') || s.startsWith("CREATE SCHEMA IF NOT EXISTS \"auth\"")) return false
    if (s.startsWith('CREATE TABLE "auth"."users"')) return false
    return true
  })

  const topExtensionsAndFunctions = [
    `CREATE EXTENSION IF NOT EXISTS postgis;`,
    `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
    `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
    `CREATE OR REPLACE FUNCTION public.jsonb_is_unique_uuid_array(input jsonb) RETURNS boolean
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.jsonb_is_unique_nonempty_text_array(input jsonb) RETURNS boolean
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.jsonb_is_spot_type_snapshot_array(input jsonb) RETURNS boolean
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
$$;`
  ]

  const customFunctionsAndTriggers = [
    `CREATE OR REPLACE FUNCTION public.bump_verification_count()
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
$$;`,
    `CREATE TRIGGER "verified_spots_count_sync"
AFTER INSERT OR DELETE ON "verified_spots"
FOR EACH ROW
EXECUTE FUNCTION public.bump_verification_count();`,
    `CREATE OR REPLACE FUNCTION public.enforce_spot_discipline_presence()
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
$$;`,
    `CREATE CONSTRAINT TRIGGER spots_require_discipline
AFTER INSERT OR UPDATE ON "spots"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_spot_discipline_presence();`,
    `CREATE OR REPLACE FUNCTION public.enforce_event_discipline_presence()
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
$$;`,
    `CREATE CONSTRAINT TRIGGER events_require_discipline
AFTER INSERT OR UPDATE ON "sport_events"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_event_discipline_presence();`,
    `CREATE OR REPLACE FUNCTION public.enforce_game_player_letters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  word text;
BEGIN
  SELECT elimination_word INTO word FROM public.game_sessions WHERE id = NEW.game_id;
  IF word IS NULL THEN RAISE EXCEPTION 'game_sessions row not found for game_players row'; END IF;
  IF NOT starts_with(word, NEW.letters) THEN RAISE EXCEPTION 'letters must be a prefix of the elimination word'; END IF;
  IF NEW.letters <> '' AND upper(NEW.letters) <> NEW.letters THEN RAISE EXCEPTION 'letters must be uppercase'; END IF;
  IF NEW.failed_attempts <> char_length(NEW.letters) THEN RAISE EXCEPTION 'failed_attempts must equal the letter length'; END IF;
  RETURN NEW;
END;
$$;`,
    `CREATE TRIGGER "game_players_letters_trigger"
BEFORE INSERT OR UPDATE ON "game_players"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_game_player_letters();`,
    `CREATE OR REPLACE FUNCTION public.emit_game_realtime_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
END;
$$;`,
    `CREATE TRIGGER "game_sessions_realtime_signal_trigger"
AFTER UPDATE OF version ON "game_sessions"
FOR EACH ROW
EXECUTE FUNCTION public.emit_game_realtime_signal();`,
    `CREATE OR REPLACE FUNCTION public.emit_event_realtime_signal()
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
$$;`,
    `CREATE TRIGGER "sport_events_realtime_signal_trigger"
AFTER UPDATE OF version ON "sport_events"
FOR EACH ROW
EXECUTE FUNCTION public.emit_event_realtime_signal();`,
    `CREATE OR REPLACE FUNCTION public.enforce_game_session_catalog_definition()
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
$$;`,
    `CREATE TRIGGER "game_session_catalog_definition_trigger"
BEFORE INSERT OR UPDATE ON "game_sessions"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_game_session_catalog_definition();`,
    `CREATE OR REPLACE FUNCTION public.enforce_immutable_game_definition()
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
$$;`,
    `CREATE TRIGGER "game_sessions_immutable_definition_trigger"
BEFORE UPDATE ON "game_sessions"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_immutable_game_definition();`,
    `CREATE OR REPLACE FUNCTION public.reject_immutable_catalog_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Challenge catalogs and their tricks are immutable once seeded';
END;
$$;`,
    `CREATE TRIGGER "challenge_catalogs_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_catalogs"
FOR EACH ROW
EXECUTE FUNCTION public.reject_immutable_catalog_mutation();`,
    `CREATE TRIGGER "challenge_catalog_tricks_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_catalog_tricks"
FOR EACH ROW
EXECUTE FUNCTION public.reject_immutable_catalog_mutation();`,
    `CREATE TRIGGER "challenge_trick_spot_types_immutable_trigger"
BEFORE UPDATE OR DELETE ON "challenge_trick_spot_types"
FOR EACH ROW
EXECUTE FUNCTION public.reject_immutable_catalog_mutation();`,
    `CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log rows cannot be updated or deleted';
END;
$$;`,
    `CREATE TRIGGER "content_audit_immutable"
BEFORE UPDATE OR DELETE ON "content_audit_log"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_mutation();`,
    `CREATE TRIGGER "admin_audit_immutable"
BEFORE UPDATE OR DELETE ON "admin_audit_log"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_mutation();`,
    `CREATE OR REPLACE FUNCTION public.league_escape_html(raw text)
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.league_email_delivery_available()
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.league_email_sweep()
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.has_permission(p_permission_slug text, p_user_id uuid)
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.has_country_scope(p_country_code text, p_user_id uuid)
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.has_discipline_scope(p_discipline_slug text, p_user_id uuid)
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.is_game_participant(target_game_id uuid, subject_user_id uuid)
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.is_round_participant(target_round_id uuid, subject_user_id uuid)
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
$$;`,
    `CREATE OR REPLACE FUNCTION public.is_event_participant(target_event_id uuid, subject_user_id uuid)
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
$$;`
  ]

  const rlsAndRealtime = [
    `ALTER TABLE "spots" ENABLE ROW LEVEL SECURITY;`,
    `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spots' AND policyname = 'spots_public_read'
  ) THEN
    CREATE POLICY "spots_public_read" ON "spots" FOR SELECT USING (
      admin_hidden = false AND (visibility = 'public' OR created_by = auth.uid())
    );
  END IF;
END $$;`,
    `ALTER TABLE "sport_events" ENABLE ROW LEVEL SECURITY;`,
    `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sport_events' AND policyname = 'sport_events_public_read'
  ) THEN
    CREATE POLICY "sport_events_public_read" ON "sport_events" FOR SELECT USING (
      visibility = 'public' OR created_by = auth.uid()
    );
  END IF;
END $$;`,
    `ALTER TABLE "user_notifications" ENABLE ROW LEVEL SECURITY;`,
    `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_notifications' AND policyname = 'user_notifications_owner'
  ) THEN
    CREATE POLICY "user_notifications_owner" ON "user_notifications" FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;`,
    `ALTER TABLE "user_email_preferences" ENABLE ROW LEVEL SECURITY;`,
    `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_email_preferences' AND policyname = 'user_email_preferences_owner'
  ) THEN
    CREATE POLICY "user_email_preferences_owner" ON "user_email_preferences" FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;`,
    `DO $$
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
END $$;`
  ]

  const allStatements = [
    ...topExtensionsAndFunctions,
    ...filteredDrizzleStatements,
    ...customFunctionsAndTriggers,
    ...rlsAndRealtime
  ]

  let outputSql = allStatements.join("\n--> statement-breakpoint\n") + "\n"
  // Unquote geography type generated by Drizzle customType so Postgres parses it as parameterized type
  outputSql = outputSql.replace(/"geography\(Point,\s*4326\)"/g, "geography(Point, 4326)")
  const targetPath = path.join(process.cwd(), "supabase", "migrations", "0000_baseline.sql")
  fs.writeFileSync(targetPath, outputSql, "utf-8")
  console.log(`✓ Wrote consolidated baseline to ${targetPath} (${allStatements.length} statements)`)

  // Clean up 0001_spotty_scrambler.sql
  fs.unlinkSync(generatedPath)
  console.log(`✓ Removed temporary ${generatedPath}`)
}

build()
