-- 0009: notification delivery (email over AWS SQS → Lambda → SES).
-- `user_notifications` becomes the transactional outbox: a row whose type is
-- email-eligible (EMAIL_POLICY in src/lib/notifications/definitions.ts) is
-- inserted with email_status = 'pending' and an urgency. The Worker enqueues
-- it after commit (immediate) or in the 15-minute tick (digest + backstop);
-- the sender Lambda reports back 'sent' / 'bounced' / 'failed'.
-- Reminders created by the tick carry a unique `dedupe_key` so a tick that
-- runs twice never notifies twice. See docs/notifications.md.
--
-- Email preferences move from one digest toggle to four categories. The old
-- `email_digests_enabled` column is backfilled into them and left in place
-- (unread) so a deploy that lags this migration keeps working; a later
-- migration drops it.
--
-- The DB-side pg_cron sweep (Resend via Vault) is retired: its function, the
-- availability probe, the cron job (if scheduled) and its dedup ledger go.

-- ---------- user_notifications: outbox columns ----------
ALTER TABLE "user_notifications" ADD COLUMN IF NOT EXISTS "email_status" text;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN IF NOT EXISTS "email_urgency" text;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN IF NOT EXISTS "email_queued_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" text;
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_email_status_check" CHECK ("user_notifications"."email_status" is null or "user_notifications"."email_status" in ('pending','queued','sent','skipped','bounced','failed'));
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_email_urgency_check" CHECK ("user_notifications"."email_urgency" is null or "user_notifications"."email_urgency" in ('immediate','digest'));
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_dedupe_key_check" CHECK ("user_notifications"."dedupe_key" is null or length("user_notifications"."dedupe_key") between 1 and 200);
--> statement-breakpoint
DROP INDEX IF EXISTS "user_notifications_email_pending_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_notifications_email_pending_idx" ON "user_notifications" USING btree ("email_urgency","created_at") WHERE "user_notifications"."email_status" = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_notifications_dedupe_key_idx" ON "user_notifications" USING btree ("dedupe_key") WHERE "user_notifications"."dedupe_key" is not null;
--> statement-breakpoint

-- ---------- user_email_preferences: categories + suppression ----------
ALTER TABLE "user_email_preferences" ADD COLUMN IF NOT EXISTS "contest_updates" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD COLUMN IF NOT EXISTS "reminders" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD COLUMN IF NOT EXISTS "judging" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD COLUMN IF NOT EXISTS "results" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD COLUMN IF NOT EXISTS "suppressed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD COLUMN IF NOT EXISTS "suppressed_reason" text;
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_suppressed_reason_check" CHECK ("user_email_preferences"."suppressed_reason" is null or "user_email_preferences"."suppressed_reason" in ('bounce','complaint'));
--> statement-breakpoint
UPDATE "user_email_preferences"
SET "contest_updates" = "email_digests_enabled",
    "reminders" = "email_digests_enabled",
    "judging" = "email_digests_enabled",
    "results" = "email_digests_enabled",
    "updated_at" = now()
WHERE "email_digests_enabled" = false;
--> statement-breakpoint

-- ---------- retire the pg_cron email sweep ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_namespace n
    JOIN pg_proc p ON p.pronamespace = n.oid
    WHERE n.nspname = 'cron' AND p.proname = 'unschedule'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'cron' AND table_name = 'job'
  ) THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'league-email-sweep') THEN
      PERFORM cron.unschedule('league-email-sweep');
    END IF;
  END IF;
END $$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.league_email_sweep();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.league_email_delivery_available();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.league_escape_html(text);
--> statement-breakpoint
DROP TABLE IF EXISTS "league_email_log";
