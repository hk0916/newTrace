CREATE TABLE "alert_settings" (
	"company_id" varchar(50) PRIMARY KEY NOT NULL,
	"low_voltage_threshold" numeric(4, 2) DEFAULT '2.5' NOT NULL,
	"high_temp_threshold" numeric(5, 2) DEFAULT '40' NOT NULL,
	"low_temp_threshold" numeric(5, 2) DEFAULT '0' NOT NULL,
	"enable_low_voltage_alert" boolean DEFAULT true NOT NULL,
	"enable_high_temp_alert" boolean DEFAULT true NOT NULL,
	"enable_low_temp_alert" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_settings" ADD CONSTRAINT "alert_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;