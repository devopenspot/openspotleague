-- League payment gate (0027).
-- Every community event must have its plan payment registered within 3 days
-- of creation or it is locked (read-only) and finally disabled at 6 days.
-- The two deadlines are stored at creation time (null for editorial events,
-- which are exempt). See .agents/specs/league/engine.spec.md.

ALTER TABLE "sport_events"
  ADD COLUMN "payment_due_at" timestamptz,
  ADD COLUMN "payment_deadline_at" timestamptz;
--> statement-breakpoint

CREATE INDEX "sport_events_payment_deadline_idx" ON "sport_events" ("payment_deadline_at");
--> statement-breakpoint
