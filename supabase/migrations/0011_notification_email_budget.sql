-- 0011: daily email budget for the free email plan (Resend Free: 100 a day,
-- 3,000 a month, no card). One row per UTC day counts the emails the Worker
-- handed to the queue. `deliveryStore.reserveEmailBudget` locks today's row,
-- sums the month, and adds only what fits under NOTIFY_EMAIL_DAILY_CAP and
-- NOTIFY_EMAIL_MONTHLY_CAP (digests stop at 60% of either). Over-budget rows
-- stay `pending` in user_notifications and expire by the dispatcher's max
-- ages; the in-app notification is unaffected.
--
-- Server-only (Drizzle as the table owner). RLS on with no policies keeps it
-- out of the Supabase Data API.

CREATE TABLE IF NOT EXISTS "notification_email_budget" (
  "day" date PRIMARY KEY,
  "sent" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "notification_email_budget_sent_check" CHECK ("sent" >= 0)
);
--> statement-breakpoint
ALTER TABLE "notification_email_budget" ENABLE ROW LEVEL SECURITY;
