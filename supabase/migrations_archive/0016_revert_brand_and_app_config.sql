-- Revert 0013/0014 — brand & app_config deprecated (full code revert)
-- Drops tables/columns introduced by those migrations if they exist.
-- Safe for fresh DB or already-migrated DB.
drop table if exists brand_discipline_section_assets cascade;
--> statement-breakpoint
drop table if exists app_sections cascade;
--> statement-breakpoint
drop table if exists app_config cascade;
--> statement-breakpoint
alter table sport_disciplines drop column if exists image_path;
--> statement-breakpoint
alter table sport_disciplines drop column if exists hero_image_path;
--> statement-breakpoint
alter table sport_disciplines drop column if exists header_preset;
