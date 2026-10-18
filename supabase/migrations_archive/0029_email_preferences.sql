-- Email delivery groundwork (0029).
-- Per-user email preferences (in-app toggle on /notifications; the daily
-- pg_cron sweep reads them before sending) and an emailed_at watermark on
-- user_notifications so the sweep never re-sends a digest row. Email itself
-- ships in 0030 (Resend via pg_net, secrets in Vault — never committed here).
--> statement-breakpoint

CREATE TABLE "user_email_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "email_digests_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "user_email_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "user_email_preferences_select_owner"
  ON "user_email_preferences" FOR SELECT TO authenticated
  USING ("user_id" = (select auth.uid()));
--> statement-breakpoint

CREATE POLICY "user_email_preferences_update_owner"
  ON "user_email_preferences" FOR UPDATE TO authenticated
  USING ("user_id" = (select auth.uid()))
  WITH CHECK ("user_id" = (select auth.uid()));
--> statement-breakpoint

ALTER TABLE "user_notifications" ADD COLUMN "emailed_at" timestamptz;
--> statement-breakpoint

CREATE INDEX "user_notifications_email_pending_idx"
  ON "user_notifications" ("created_at")
  WHERE "emailed_at" IS NULL
    AND "type" IN (
      'league_invite_received',
      'league_registration_confirmed',
      'league_schedule_published',
      'league_event_started',
      'league_event_cancelled',
      'league_results_published',
      'league_points_earned'
    );
--> statement-breakpoint
