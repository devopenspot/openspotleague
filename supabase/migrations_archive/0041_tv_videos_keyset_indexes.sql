-- 0041: Add partial composite keyset indexes for TV catalog queries to avoid sequential scans and filesorts.
CREATE INDEX IF NOT EXISTS "tv_videos_published_keyset_idx"
  ON "tv_videos" ("sort_order" ASC, "post_date" DESC, "created_at" DESC, "id" DESC)
  WHERE ("published" = true);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tv_videos_published_discipline_keyset_idx"
  ON "tv_videos" ("discipline_slug" ASC, "sort_order" ASC, "post_date" DESC, "created_at" DESC, "id" DESC)
  WHERE ("published" = true);
--> statement-breakpoint
