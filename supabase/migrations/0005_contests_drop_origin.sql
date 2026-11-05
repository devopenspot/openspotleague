-- 0005: sport events become league contests.
-- The editorial ("seed") origin is gone: every contest is created by a user or
-- a contest curator and is settled only by an active paid/comped payment.
-- Drop `origin` with its index and check, re-key the per-creator quota index,
-- keep free-plan contests off the public listing, and stop the payment
-- reminder sweep from filtering on the dropped column.

DROP INDEX IF EXISTS "sport_events_created_by_origin_created_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "sport_events_origin_idx";
--> statement-breakpoint
ALTER TABLE "sport_events" DROP CONSTRAINT IF EXISTS "sport_events_origin_check";
--> statement-breakpoint
ALTER TABLE "sport_events" DROP COLUMN IF EXISTS "origin";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sport_events_created_by_created_idx" ON "sport_events" USING btree ("created_by","created_at");
--> statement-breakpoint
-- Public listing is a paid-plan feature: anything without an active paid or
-- comped payment on a non-free plan goes back to unlisted (shared by QR code).
UPDATE "sport_events" e
SET "visibility" = 'unlisted', "updated_at" = now()
WHERE e."visibility" = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM "event_payments" p
    WHERE p."event_id" = e."id"
      AND p."status" IN ('paid', 'comped')
      AND p."plan_slug" <> 'free'
  );
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
    WHERE e.status NOT IN ('completed', 'cancelled')
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
