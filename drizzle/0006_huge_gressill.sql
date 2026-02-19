CREATE TABLE IF NOT EXISTS "alert_history" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"company_id" varchar(50) NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"alert_key" varchar(100) NOT NULL,
	"alert_name" varchar(200) NOT NULL,
	"alert_message" text NOT NULL,
	"triggered_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar(50)
);
--> statement-breakpoint
ALTER TABLE "asset_map_gateways" ALTER COLUMN "gw_mac" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "gateway_status" ALTER COLUMN "gw_mac" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "gateways" ALTER COLUMN "gw_mac" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "tag_sensing_data" ALTER COLUMN "tag_mac" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "tag_sensing_data" ALTER COLUMN "gw_mac" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "tag_mac" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "assigned_gw_mac" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "asset_maps" ADD COLUMN IF NOT EXISTS "show_on_dashboard" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "timezone" varchar(50) DEFAULT 'browser' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" varchar(10) DEFAULT 'ko' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
