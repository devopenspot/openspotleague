-- 0038: drop stale auto-named level checks (1-3) on game_rounds and rider_score_events.
--
-- 0000_baseline declared `trick_level` with an inline CHECK (... BETWEEN 1 AND 3),
-- which Postgres auto-names as `{table}_{column}_check`. 0008 widened levels to
-- 1-5 and added the named `game_rounds_level_check` / `rider_score_events_level_check`
-- constraints, but its drop statements targeted those new names — `drop constraint
-- if exists` no-oped — so the stale auto-named 1-3 checks survived alongside them.
-- Any game round created at level 4 or 5 (training or challenge) then failed with
-- a 23514 check violation on `game_rounds_trick_level_check`, surfacing as a 500
-- at POST /api/games. Levels 1-3 kept working, which masked the bug.
--
-- trick_definitions, challenge_catalog_tricks, and game_sessions next_level used
-- the correct auto-named drop targets in 0008 and are already fine.
--
-- The schema source (src/db/schema/index.ts) only declares the named 1-5 checks;
-- dropping these stale DB-only constraints closes the drift.

alter table game_rounds drop constraint if exists game_rounds_trick_level_check;
--> statement-breakpoint
alter table rider_score_events drop constraint if exists rider_score_events_trick_level_check;
