-- Phase 1: categories + levels 1-5
alter table trick_definitions add column if not exists categories jsonb not null default '[]'::jsonb;
--> statement-breakpoint
alter table challenge_catalog_tricks add column if not exists categories jsonb not null default '[]'::jsonb;
--> statement-breakpoint
alter table trick_definitions drop constraint if exists trick_definitions_level_check;
--> statement-breakpoint
alter table trick_definitions add constraint trick_definitions_level_check check (level between 1 and 5);
--> statement-breakpoint
alter table trick_definitions drop constraint if exists trick_definitions_categories_check;
--> statement-breakpoint
alter table trick_definitions add constraint trick_definitions_categories_check check (jsonb_typeof(categories) = 'array' and jsonb_array_length(categories) <= 12);
--> statement-breakpoint
alter table challenge_catalog_tricks drop constraint if exists challenge_catalog_tricks_level_check;
--> statement-breakpoint
alter table challenge_catalog_tricks add constraint challenge_catalog_tricks_level_check check (level between 1 and 5);
--> statement-breakpoint
alter table challenge_catalog_tricks drop constraint if exists challenge_catalog_tricks_categories_check;
--> statement-breakpoint
alter table challenge_catalog_tricks add constraint challenge_catalog_tricks_categories_check check (jsonb_typeof(categories) = 'array' and jsonb_array_length(categories) <= 12);
--> statement-breakpoint
alter table game_sessions drop constraint if exists game_sessions_next_level_check;
--> statement-breakpoint
alter table game_sessions add constraint game_sessions_next_level_check check (next_level is null or next_level between 1 and 5);
--> statement-breakpoint
alter table game_rounds drop constraint if exists game_rounds_level_check;
--> statement-breakpoint
alter table game_rounds add constraint game_rounds_level_check check (trick_level is null or trick_level between 1 and 5);
--> statement-breakpoint
alter table rider_score_events drop constraint if exists rider_score_events_level_check;
--> statement-breakpoint
alter table rider_score_events add constraint rider_score_events_level_check check (trick_level is null or trick_level between 1 and 5);
--> statement-breakpoint
alter table challenge_catalogs add column if not exists level_four_count integer not null default 0;
--> statement-breakpoint
alter table challenge_catalogs add column if not exists level_five_count integer not null default 0;
--> statement-breakpoint
alter table challenge_catalogs drop constraint if exists challenge_catalogs_counts_check;
--> statement-breakpoint
alter table challenge_catalogs add constraint challenge_catalogs_counts_check check (trick_count >= 1 and level_one_count + level_two_count + level_three_count + level_four_count + level_five_count = trick_count);
--> statement-breakpoint
