CREATE TABLE IF NOT EXISTS "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_country_code_slug_key" UNIQUE("country_code","slug"),
	CONSTRAINT "cities_name_check" CHECK (length("cities"."name") > 0),
	CONSTRAINT "cities_slug_check" CHECK (length("cities"."slug") > 0),
	CONSTRAINT "cities_sort_order_check" CHECK ("cities"."sort_order" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cities" ADD CONSTRAINT "cities_country_code_countries_iso2_fk"
    FOREIGN KEY ("country_code") REFERENCES "public"."countries"("iso2") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cities_country_code_sort_order_idx" ON "cities" USING btree ("country_code","sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cities_slug_idx" ON "cities" USING btree ("slug");
