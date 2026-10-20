CREATE TABLE IF NOT EXISTS "short_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"target_url" text NOT NULL,
	"title" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_links_code_check" CHECK (length("short_links"."code") >= 4 and length("short_links"."code") <= 32),
	CONSTRAINT "short_links_target_url_check" CHECK (length("short_links"."target_url") > 0 and length("short_links"."target_url") <= 2048)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "short_links_code_idx" ON "short_links" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "short_links_target_url_idx" ON "short_links" USING btree ("target_url");
