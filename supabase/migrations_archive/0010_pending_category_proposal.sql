alter table game_sessions add column if not exists pending_categories jsonb;
--> statement-breakpoint
alter table game_sessions add column if not exists pending_proposer_player_id uuid;
--> statement-breakpoint
alter table game_sessions add column if not exists pending_votes jsonb;
--> statement-breakpoint
alter table game_sessions add column if not exists pending_proposal_created_at timestamp with time zone;
--> statement-breakpoint
alter table game_sessions add constraint game_sessions_pending_categories_check check (pending_categories is null or (jsonb_typeof(pending_categories) = 'array' and jsonb_array_length(pending_categories) <= 12));
--> statement-breakpoint
