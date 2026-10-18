-- In-app user notifications (0028).
-- League mutations fan out notification rows inside the same transaction as
-- the triggering write (no queue/worker — see plan.league.spec.md). Realtime
-- delivery rides the supabase_realtime publication; RLS restricts each user
-- to their own rows. Email/push delivery (Resend + pg_cron sweep) is Phase 5.
--> statement-breakpoint

CREATE TABLE "user_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "event_id" uuid REFERENCES "sport_events"("id") ON DELETE SET NULL,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX "user_notifications_user_created_idx"
  ON "user_notifications" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "user_notifications_user_unread_idx"
  ON "user_notifications" ("user_id")
  WHERE "read_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "user_notifications_event_idx"
  ON "user_notifications" ("event_id");
--> statement-breakpoint

ALTER TABLE "user_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "user_notifications_select_owner"
  ON "user_notifications" FOR SELECT TO authenticated
  USING ("user_id" = (select auth.uid()));
--> statement-breakpoint

CREATE POLICY "user_notifications_update_owner"
  ON "user_notifications" FOR UPDATE TO authenticated
  USING ("user_id" = (select auth.uid()))
  WITH CHECK ("user_id" = (select auth.uid()));
--> statement-breakpoint

-- Full row payloads for INSERT broadcast on the per-user channel.
ALTER TABLE "user_notifications" REPLICA IDENTITY FULL;
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
       AND c.relname = 'user_notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION "supabase_realtime" ADD TABLE public.user_notifications';
  END IF;
END
$$;
--> statement-breakpoint
