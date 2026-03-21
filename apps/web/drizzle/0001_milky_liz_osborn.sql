CREATE TABLE "listing_price_history" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"previous_price_cents" integer,
	"change_type" text NOT NULL,
	"change_percent" real,
	"source" text NOT NULL,
	"promotion_id" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lph_listing" ON "listing_price_history" USING btree ("listing_id","recorded_at");--> statement-breakpoint
CREATE INDEX "lph_change_type" ON "listing_price_history" USING btree ("listing_id","change_type");