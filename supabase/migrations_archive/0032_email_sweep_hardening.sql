-- Email sweep hardening (0032) — replaces the 0030 function body (applied
-- files are immutable; semantic fixes ship as new files):
-- 1. HTML-escape every user-controlled string (event names reach third-party
--    email clients — injection into Resend HTML bodies is not acceptable).
-- 2. One reminder per event per run (highest applicable day) instead of a
--    day-2/3/6 catch-up burst when the sweep was down.
-- 3. Day-6 copy no longer instructs creators to self-revive a disabled event
--    (only administrators can register a payment there).
-- 4. Digest: per-user advisory lock + post-enqueue watermark so overlapping
--    runs cannot double-send, and the string_agg can no longer observe rows
--    that were watermarked mid-run (NULL-body edge).
-- 5. Rows older than the 24h window that were never emailed get watermarked
--    (catch-up pass) so the partial pending index cannot grow forever.
-- 6. Digest whitelist updated: league_invite_received retired (never emitted);
--    canonical subset lives in src/lib/notifications/definitions.ts
--    (EMAIL_DIGEST_TYPES) with a drift test.
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "league_escape_html"(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET "search_path" = public
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

  -- 1) Payment-gate reminder for community events without an active payment
  --    (free $0 included). Mirrors lib/league/engine gate math: 3 days to
  --    register, then locked, disabled at 6 days. One email per event per
  --    run — the highest applicable un-sent day only (no catch-up burst).
  --    Deduped by (event, kind, day) via league_email_log.
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
    IF FOUND THEN
      link := app_url || '/sport-events/' || rec.slug || '/manage';
      subject := CASE rec.day
        WHEN 2 THEN 'Reminder: register a plan for ' || league_escape_html(rec.name)
        WHEN 3 THEN 'Action needed: ' || league_escape_html(rec.name) || ' is locked'
        ELSE 'Final notice: ' || league_escape_html(rec.name) || ' is disabled'
      END;
      body_html := CASE rec.day
        WHEN 2 THEN '<p>Your community event <strong>' || league_escape_html(rec.name) || '</strong> still needs a plan registration (the free plan is $0 and self-registers instantly). Three days after creation the event becomes read-only.</p>'
        WHEN 3 THEN '<p><strong>' || league_escape_html(rec.name) || '</strong> is now locked: everyone can still view it, but registration and runs are read-only until you register a plan payment.</p>'
        ELSE '<p><strong>' || league_escape_html(rec.name) || '</strong> is disabled. This is the final notice — contact an administrator to restore the event with a plan payment.</p>'
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

  -- 2) 24h digest of league notification rows not yet emailed. A per-user
  --    transaction advisory lock serializes overlapping sweeps (manual run
  --    vs cron): the loser skips the user entirely, so delivery stays
  --    at-most-once per row batch.
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
    CONTINUE WHEN NOT pg_try_advisory_xact_lock(
      hashtextextended('league-digest:' || rec.user_id::text, 0));

    SELECT
      count(*)::int,
      '' || string_agg(
        '<li><strong>' || CASE n.type
          WHEN 'league_registration_confirmed' THEN 'Registration confirmed'
          WHEN 'league_schedule_published' THEN 'Schedule published'
          WHEN 'league_event_started' THEN 'Event is live'
          WHEN 'league_event_cancelled' THEN 'Event cancelled'
          WHEN 'league_results_published' THEN 'Results published'
          WHEN 'league_points_earned' THEN 'League points awarded'
          ELSE league_escape_html(n.type) END
        || '</strong> — ' || league_escape_html(coalesce(n.payload->>'eventName', 'OpenSpot'))
        || '</li>', '')
    INTO body_count, body_html
    FROM user_notifications n
    WHERE n.user_id = rec.user_id
      AND n.emailed_at IS NULL
      AND n.created_at >= now() - interval '24 hours'
      AND n.type = ANY (digest_types);

    IF body_count > 0 THEN
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

      -- Watermark after the enqueue call so a failed/absent enqueue can
      -- never strand un-emailed rows.
      UPDATE user_notifications
        SET emailed_at = now()
        WHERE user_id = rec.user_id
          AND emailed_at IS NULL
          AND created_at >= now() - interval '24 hours'
          AND type = ANY (digest_types);
    END IF;
  END LOOP;

  -- 3) Catch-up: rows that fell out of the 24h window without ever being
  --    emailed (sweep outage) can never be sent — watermark them so the
  --    partial pending index stops growing.
  UPDATE user_notifications
    SET emailed_at = now()
    WHERE emailed_at IS NULL
      AND created_at < now() - interval '24 hours'
      AND type = ANY (digest_types);
END;
$$;
--> statement-breakpoint
