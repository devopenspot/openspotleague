DROP TRIGGER IF EXISTS "game_sessions_realtime_signal_trigger" ON "game_sessions";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.emit_game_realtime_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.version IS NOT DISTINCT FROM OLD.version THEN RETURN NEW; END IF;
  INSERT INTO public.game_realtime_signals (game_id, version, signal_type)
  VALUES (
    NEW.id,
    NEW.version,
    CASE NEW.status
      WHEN 'complete' THEN 'game_completed'
      WHEN 'cancelled' THEN 'game_cancelled'
      ELSE 'game_state_changed'
    END
  )
  ON CONFLICT (game_id, version) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "game_sessions_realtime_signal_trigger"
AFTER UPDATE OF version ON "game_sessions"
FOR EACH ROW
EXECUTE FUNCTION public.emit_game_realtime_signal();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "game_players_letters_trigger" ON "game_players";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_game_player_letters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  word text;
BEGIN
  SELECT elimination_word INTO word FROM public.game_sessions WHERE id = NEW.game_id;
  IF word IS NULL THEN RAISE EXCEPTION 'game_sessions row not found for game_players row'; END IF;
  IF NOT starts_with(word, NEW.letters) THEN RAISE EXCEPTION 'letters must be a prefix of the elimination word'; END IF;
  IF NEW.letters <> '' AND upper(NEW.letters) <> NEW.letters THEN RAISE EXCEPTION 'letters must be uppercase'; END IF;
  IF NEW.failed_attempts <> char_length(NEW.letters) THEN RAISE EXCEPTION 'failed_attempts must equal the letter length'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "game_players_letters_trigger"
BEFORE INSERT OR UPDATE ON "game_players"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_game_player_letters();
