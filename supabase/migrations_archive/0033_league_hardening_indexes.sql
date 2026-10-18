-- League hardening indexes + realtime trigger removal (0033).
-- 1. Missing FK index: invite-replay lookup counts active members per invite.
-- 2. Quota hot path: every community event creation counts this month's rows
--    by creator; (created_by, origin, created_at) keeps it index-only.
-- 3. Drop `sport_events_realtime_signal_trigger`: it fired on every version
--    bump and, because the service writes its typed signal AFTER the bump at
--    the same (event_id, version) key, ON CONFLICT DO NOTHING always kept the
--    service row and the trigger's generic signal was dead code (or worse,
--    shadowed nothing). The service is now the single signal writer. Known
--    tradeoff: editorial/admin content edits no longer emit a generic signal;
--    consoles recover via STALE_VERSION refetch. All 7 signal types are
--    written by src/lib/services/league (score_submitted included).
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_memberships_invite_idx"
  ON "event_memberships" ("joined_via_invite_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sport_events_created_by_origin_created_idx"
  ON "sport_events" ("created_by", "origin", "created_at");
--> statement-breakpoint

DROP TRIGGER IF EXISTS "sport_events_realtime_signal_trigger" ON "sport_events";
--> statement-breakpoint

DROP FUNCTION IF EXISTS public.emit_event_realtime_signal();
--> statement-breakpoint
