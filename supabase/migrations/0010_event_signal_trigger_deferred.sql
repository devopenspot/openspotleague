-- 0010: keep the League service's specific realtime signal types.
-- `sport_events_realtime_signal_trigger` ran AFTER UPDATE OF version, i.e.
-- inside the mutation's `bumpEventVersion` statement, and inserted a generic
-- `event_state_changed` / `event_cancelled` row for (event_id, version)
-- before the service's `recordEventSignal` ran. The service insert then hit
-- the unique (event_id, version) constraint with ON CONFLICT DO NOTHING, so
-- `registration_changed`, `schedule_published`, `run_started`,
-- `score_submitted` and `results_published` were never stored.
--
-- The trigger becomes a deferrable constraint trigger, INITIALLY DEFERRED:
-- it fires at commit, after the service wrote its specific row, so its
-- ON CONFLICT DO NOTHING only fills in for version bumps that recorded no
-- signal (the safety net it was meant to be). One INSERT per version still
-- reaches the `supabase_realtime` publication, so clients see no extra
-- events. The insert is skipped if the event was deleted later in the same
-- transaction, so a cascade can never fail the commit on the foreign key.

CREATE OR REPLACE FUNCTION public.emit_event_realtime_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.version IS NOT DISTINCT FROM OLD.version THEN RETURN NEW; END IF;
  INSERT INTO public.event_realtime_signals (event_id, version, signal_type)
  SELECT
    NEW.id,
    NEW.version,
    CASE NEW.status
      WHEN 'cancelled' THEN 'event_cancelled'
      ELSE 'event_state_changed'
    END
  WHERE EXISTS (SELECT 1 FROM public.sport_events WHERE id = NEW.id)
  ON CONFLICT (event_id, version) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- Swap atomically so no version bump commits without a trigger in place.
--> tx-begin
DROP TRIGGER IF EXISTS "sport_events_realtime_signal_trigger" ON "sport_events";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "sport_events_realtime_signal_trigger"
AFTER UPDATE OF version ON "sport_events"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.emit_event_realtime_signal();
--> tx-commit
