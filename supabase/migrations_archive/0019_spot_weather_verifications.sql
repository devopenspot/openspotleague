-- Spot + weather co-verification: many weather votes per user with 2h TTL
CREATE TABLE IF NOT EXISTS "spot_weather_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spot_id" uuid NOT NULL REFERENCES "spots"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE cascade,
  "vote_icon" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "spot_weather_verifications_vote_icon_check" CHECK ("vote_icon" IN ('sunny','partly_cloudy_day','cloudy','rain','snow')),
  CONSTRAINT "spot_weather_verifications_expires_after_created_check" CHECK ("expires_at" > "created_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spot_weather_verifications_spot_expires_idx" ON "spot_weather_verifications" USING btree ("spot_id","expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spot_weather_verifications_spot_created_idx" ON "spot_weather_verifications" USING btree ("spot_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spot_weather_verifications_user_spot_created_idx" ON "spot_weather_verifications" USING btree ("user_id","spot_id","created_at");
