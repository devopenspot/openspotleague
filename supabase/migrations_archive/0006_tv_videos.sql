-- TV videos — YouTube discipline channel
-- New table for curated YouTube videos classified by discipline/category/post_date
-- Also extend content_audit_log entity_type to include tv_video

CREATE TABLE IF NOT EXISTS "tv_videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL CHECK (length("title") > 0),
  "youtube_url" text NOT NULL CHECK (length("youtube_url") > 0),
  "discipline_slug" text NOT NULL REFERENCES "sport_disciplines"("slug") ON DELETE RESTRICT,
  "category" text NOT NULL CHECK ("category" IN ('profile','event','music','trick','documentary','lifestyle')),
  "post_date" timestamptz NOT NULL,
  "published" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tv_videos_published_discipline_post_date_idx" ON "tv_videos" ("published", "discipline_slug", "post_date" DESC, "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tv_videos_category_idx" ON "tv_videos" ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tv_videos_published_sort_idx" ON "tv_videos" ("published", "sort_order", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tv_videos_discipline_idx" ON "tv_videos" ("discipline_slug");
--> statement-breakpoint

-- Extend audit log to include tv_video
ALTER TABLE "content_audit_log" DROP CONSTRAINT IF EXISTS "content_audit_log_entity_type_check";
--> statement-breakpoint
ALTER TABLE "content_audit_log" ADD CONSTRAINT "content_audit_log_entity_type_check" CHECK ("entity_type" IN ('spot', 'event', 'trick', 'tv_video'));
--> statement-breakpoint

-- RLS: service_role only (Drizzle)
ALTER TABLE "tv_videos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "tv_videos" FROM anon, authenticated;
--> statement-breakpoint

-- Seed tv_curator role (idempotent)
INSERT INTO "roles" ("slug", "name", "description")
VALUES ('tv_curator', 'TV Curator', 'Manages TV videos scoped by discipline')
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

-- Assign minimal perms to tv_curator: content.read + taxonomy.use (no media.manage needed for link-only)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.slug = 'tv_curator' AND p.slug IN ('content.read', 'taxonomy.use')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
