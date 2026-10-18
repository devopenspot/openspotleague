-- 0036: purge the legacy inline baseline.
--
-- `0007_baseline_data.sql` seeds the original 171 Google-hosted spots,
-- the inline sport_events / event_disciplines rows and the trick +
-- challenge catalog fixtures whenever the migration set is applied from
-- scratch (every `db:reset` drops `schema_migrations`, so 0007 re-runs
-- and resurrects them on top of `seed.ts` data).
--
-- The application's data scope is now "spots + admin only": seed content
-- comes exclusively from `src/db/seed.ts` / `src/data/spots.json`, and
-- feature rows (events, challenge catalogs, tricks, game imports from
-- catalogs) stay absent. This migration removes the resurrected baseline
-- rows so fresh applies converge on exactly the seed data set.
--
-- FK safety: game/leaf tables first (game_sessions is RESTRICT against
-- challenge_catalogs + spots; spot_weather_reports is RESTRICT against
-- spots), then challenge + trick tables, then events, then the legacy
-- spots themselves (spot_type_assignments / spot_disciplines /
-- spot_images / verified / saved / weather verifications cascade; the
-- rest migrate to NULL).
--
-- Discriminator: legacy spots are exactly the Google-hosted-image rows;
-- migrated spots use the `spots.cdn.openspotleague.com` CDN or a
-- `placeholder.local` fallback (0 Google-hosted URLs exist in
-- `src/data/spots.json`). Idempotent: every statement no-ops once the
-- rows are gone.

-- Game feature tables (children first)
delete from game_realtime_signals;
delete from game_race_laps;
delete from game_location_verifications;
delete from game_action_requests;
delete from game_attempts;
delete from game_rounds;
delete from game_players;
delete from game_sessions;

-- Challenge / trick feature tables (children first; game_sessions is
-- already purged above so its RESTRICT FKs to challenge_catalogs are clear)
-- The catalog tables carry BEFORE UPDATE/DELETE triggers enforcing catalog
-- immutability; the purge is the sanctioned path, so disable → purge →
-- re-enable (INSERT-based re-seeding via `db:seed-tricks` stays possible).
alter table challenge_catalogs disable trigger challenge_catalogs_immutable_trigger;
alter table challenge_catalog_tricks disable trigger challenge_catalog_tricks_immutable_trigger;
alter table challenge_trick_spot_types disable trigger challenge_trick_spot_types_immutable_trigger;
delete from challenge_trick_spot_types;
delete from trick_definition_spot_types;
delete from challenge_catalog_tricks;
delete from trick_catalog_states;
delete from challenge_catalogs;
delete from trick_definitions;
alter table challenge_trick_spot_types enable trigger challenge_trick_spot_types_immutable_trigger;
alter table challenge_catalog_tricks enable trigger challenge_catalog_tricks_immutable_trigger;
alter table challenge_catalogs enable trigger challenge_catalogs_immutable_trigger;
delete from spot_challenge_records;
delete from rider_score_events;
delete from rider_stats;

-- Weather reports are RESTRICT against spots; user artifacts, not content
delete from spot_weather_reports;

-- Event feature tables (children first; on a live DB these can RESTRICT)
delete from event_realtime_signals;
delete from event_action_requests;
delete from event_points_ledger;
delete from event_results;
delete from event_scores;
delete from event_runs;
delete from event_scoring_criteria;
delete from event_memberships;
delete from event_invites;
delete from event_payments;
delete from user_event_plans;
delete from sport_events; -- event_disciplines cascades

-- Legacy baseline spots: Google-hosted images only
delete from spots where image_url like '%lh3.googleusercontent.com%';
