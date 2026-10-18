-- League email delivery (0030) — Phase 5.
-- Daily pg_cron sweep, approved in plan.league.spec.md: computes payment-gate
-- states read-only and sends day-2/3/6 plan reminders to event creators, plus
-- a 24h digest of league notification rows (results/invites/registration) —
-- both through Resend over pg_net. Secrets live in Supabase Vault and are
-- NEVER committed: register them once per project with
--   select vault.create_secret('<resend key>', 'resend_api_key', 'Resend API key');
--   select vault.create_secret('OpenSpot <you@yourdomain.com>', 'email_from', 'From header');
--   select vault.create_secret('https://your-app-domain', 'app_public_url', 'Deep-link base');
-- Missing resend_api_key makes every run a no-op (build/dev safe).
--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS pg_cron;
--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS pg_net;
--> statement-breakpoint

CREATE TABLE "league_email_log" (
  "event_id" uuid NOT NULL REFERENCES "sport_events"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "day" integer NOT NULL,
  "recipients" text[] NOT NULL DEFAULT '{}',
  "sent_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("event_id", "kind", "day")
);
--> statement-breakpoint

ALTER TABLE "league_email_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "league_email_sweep"()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" = public, vault, extensions, cron, net
AS $$
DECLARE
  api_key text;
  from_addr text;
  app_url text;
  digest_types text[] := array[
    'league_invite_received',
    'league_registration_confirmed',
    'league_schedule_published',
    'league_event_started',
    'league_event_cancelled',
    'league_results_published',
    'league_points_earned'
  ];
  rec record;
  subject text;
  body_html text;
  body_count int;
  link text;
BEGIN
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE 'league_email_sweep: resend_api_key not set in vault; skipping run';
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

  -- 1) Payment-gate reminders for community events without an active
  --    payment (free $0 included). Mirrors lib/league/engine gate math:
  --    3 days to register, then locked, disabled at 6 days. Deduped by
  --    (event, kind, day) via league_email_log.
  FOR rec IN
    SELECT e.id, e.name, e.slug, au.email AS creator_email, d.day
    FROM sport_events e
    JOIN auth.users au ON au.id = e.created_by
    CROSS JOIN (VALUES (2), (3), (6)) AS d(day)
    WHERE e.origin = 'community'
      AND e.status NOT IN ('completed', 'cancelled')
      AND (now() - e.created_at) >= make_interval(days => d.day)
      AND au.email IS NOT NULL AND au.email <> ''
      AND NOT EXISTS (
        SELECT 1 FROM event_payments p
        WHERE p.event_id = e.id AND p.status IN ('paid', 'comped'))
      AND NOT EXISTS (
        SELECT 1 FROM league_email_log l
        WHERE l.event_id = e.id
          AND l.kind = 'payment_reminder'
          AND l.day = d.day)
  LOOP
    INSERT INTO league_email_log(event_id, kind, day, recipients)
      VALUES (rec.id, 'payment_reminder', rec.day, ARRAY[rec.creator_email])
      ON CONFLICT DO NOTHING;
    IF FOUND THEN
      link := app_url || '/sport-events/' || rec.slug || '/manage';
      subject := CASE rec.day
        WHEN 2 THEN 'Reminder: register a plan for ' || rec.name
        WHEN 3 THEN 'Action needed: ' || rec.name || ' is locked'
        ELSE 'Final notice: ' || rec.name || ' is disabled'
      END;
      body_html := CASE rec.day
        WHEN 2 THEN '<p>Your community event <strong>' || rec.name || '</strong> still needs a plan registration (the free plan is $0 and self-registers instantly). You have 3 days from creation — after that the event becomes read-only.</p>'
        WHEN 3 THEN '<p><strong>' || rec.name || '</strong> is now locked: everyone can still view it, but registration and runs are read-only until you register a plan payment.</p>'
        ELSE '<p><strong>' || rec.name || '</strong> is disabled. This is the final notice — a plan payment (or a free self-registration) is the only way to bring it back.</p>'
      END;
      body_html := body_html || '<p><a href="' || link || '">Manage the event</a></p><p style="color:#888;font-size:12px">You receive this because you created this event on OpenSpot.</p>';
      PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'authorization', 'Bearer ' || api_key,
          'content-type', 'application/json'
        ),
        body := jsonb_build_object(
          'from', from_addr,
          'to', jsonb_build_array(rec.creator_email),
          'subject', subject,
          'html', body_html
        )
      );
    END IF;
  END LOOP;

  -- 2) 24h digest of league notification rows not yet emailed (results,
  --    invites, registration, schedule, points). Respects per-user email
  --    preferences; watermark via emailed_at right after enqueue.
  FOR rec IN
    SELECT DISTINCT n.user_id, au.email
    FROM user_notifications n
    JOIN auth.users au ON au.id = n.user_id
    LEFT JOIN user_email_preferences p ON p.user_id = n.user_id
    WHERE n.emailed_at IS NULL
      AND n.created_at >= now() - interval '24 hours'
      AND n.type = ANY (digest_types)
      AND coalesce(p.email_digests_enabled, true)
      AND au.email IS NOT NULL AND au.email <> ''
  LOOP
    SELECT
      count(*)::int,
      '' || string_agg(
        '<li><strong>' || CASE n.type
          WHEN 'league_invite_received' THEN 'New invite'
          WHEN 'league_registration_confirmed' THEN 'Registration confirmed'
          WHEN 'league_schedule_published' THEN 'Schedule published'
          WHEN 'league_event_started' THEN 'Event is live'
          WHEN 'league_event_cancelled' THEN 'Event cancelled'
          WHEN 'league_results_published' THEN 'Results published'
          WHEN 'league_points_earned' THEN 'League points awarded'
          ELSE n.type END
        || '</strong> — ' || coalesce(n.payload->>'eventName', 'OpenSpot')
        || '</li>', '')
    INTO body_count, body_html
    FROM user_notifications n
    WHERE n.user_id = rec.user_id
      AND n.emailed_at IS NULL
      AND n.created_at >= now() - interval '24 hours'
      AND n.type = ANY (digest_types);

    UPDATE user_notifications
      SET emailed_at = now()
      WHERE user_id = rec.user_id
        AND emailed_at IS NULL
        AND created_at >= now() - interval '24 hours'
        AND type = ANY (digest_types);

    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'authorization', 'Bearer ' || api_key,
        'content-type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', from_addr,
        'to', jsonb_build_array(rec.email),
        'subject', 'OpenSpot: ' || body_count || ' league updates',
        'html', '<h3>Your last 24h on OpenSpot</h3><ul>' || body_html || '</ul><p><a href="' || app_url || '/notifications">Open notifications</a></p><p style="color:#888;font-size:12px">Turn email digests off in-app: ' || app_url || '/notifications</p>'
      )
    );
  END LOOP;
END;
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'league-email-sweep') THEN
    PERFORM cron.schedule('league-email-sweep', '17 9 * * *', 'select league_email_sweep()');
  END IF;
END
$$;
--> statement-breakpoint
