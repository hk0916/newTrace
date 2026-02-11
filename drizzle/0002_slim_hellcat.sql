CREATE TABLE "alert_acknowledgments" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"company_id" varchar(50) NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"alert_key" varchar(100) NOT NULL,
	"session_iat" integer NOT NULL,
	"acknowledged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_settings" ADD COLUMN "tag_last_update_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_settings" ADD COLUMN "gw_disconnect_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_settings" ADD COLUMN "enable_tag_heartbeat_alert" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_settings" ADD COLUMN "enable_gw_disconnect_alert" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_acknowledgments" ADD CONSTRAINT "alert_acknowledgments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_acknowledgments" ADD CONSTRAINT "alert_acknowledgments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;