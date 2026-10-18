-- Remove deprecated external_posts (YouTube/Instagram carousel) feature
--> statement-breakpoint
DROP POLICY IF EXISTS "external_posts_select_published" ON "external_posts";
--> statement-breakpoint
DROP TABLE IF EXISTS "external_posts" CASCADE;
