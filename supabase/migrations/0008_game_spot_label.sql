-- 0008: Training journal place name.
-- Training games can be logged anywhere. When the rider does not attach a
-- registered spot, they may type a free-text place name ("my driveway",
-- "the DIY under the bridge") so their training history reads like a
-- storyboard. No location check is attached to it, and it never earns points.

ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "spot_label" text;
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_spot_label_check" CHECK (
  "game_sessions"."spot_label" is null or (
    "game_sessions"."mode" = 'training'
    and "game_sessions"."spot_id" is null
    and char_length("game_sessions"."spot_label") between 1 and 80
  )
);
