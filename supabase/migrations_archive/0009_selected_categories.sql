alter table game_sessions add column if not exists selected_categories jsonb;
--> statement-breakpoint
alter table game_sessions add constraint game_sessions_selected_categories_check check (selected_categories is null or (jsonb_typeof(selected_categories) = 'array' and jsonb_array_length(selected_categories) <= 12));
--> statement-breakpoint
