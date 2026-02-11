CREATE TABLE "companies" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_status" (
	"gw_mac" varchar(17) PRIMARY KEY NOT NULL,
	"hw_version" varchar(50),
	"fw_version" varchar(50),
	"ota_server_url" varchar(512),
	"ws_server_url" varchar(512),
	"report_interval" integer,
	"rssi_filter" integer,
	"ip_address" varchar(45),
	"port" integer,
	"is_connected" boolean DEFAULT false NOT NULL,
	"last_connected_at" timestamp,
	"last_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateways" (
	"gw_mac" varchar(17) PRIMARY KEY NOT NULL,
	"gw_name" varchar(255) NOT NULL,
	"company_id" varchar(50) NOT NULL,
	"location" varchar(255),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_sensing_data" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"tag_mac" varchar(17) NOT NULL,
	"gw_mac" varchar(17) NOT NULL,
	"sensing_time" timestamp NOT NULL,
	"received_time" timestamp DEFAULT now() NOT NULL,
	"rssi" integer NOT NULL,
	"temperature" numeric(5, 2),
	"voltage" numeric(4, 2),
	"raw_data" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"tag_mac" varchar(17) PRIMARY KEY NOT NULL,
	"tag_name" varchar(255) NOT NULL,
	"company_id" varchar(50) NOT NULL,
	"assigned_gw_mac" varchar(17),
	"report_interval" integer NOT NULL,
	"asset_type" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"password" varchar(255),
	"company_id" varchar(50),
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "gateway_status" ADD CONSTRAINT "gateway_status_gw_mac_gateways_gw_mac_fk" FOREIGN KEY ("gw_mac") REFERENCES "public"."gateways"("gw_mac") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateways" ADD CONSTRAINT "gateways_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_sensing_data" ADD CONSTRAINT "tag_sensing_data_tag_mac_tags_tag_mac_fk" FOREIGN KEY ("tag_mac") REFERENCES "public"."tags"("tag_mac") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_sensing_data" ADD CONSTRAINT "tag_sensing_data_gw_mac_gateways_gw_mac_fk" FOREIGN KEY ("gw_mac") REFERENCES "public"."gateways"("gw_mac") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_assigned_gw_mac_gateways_gw_mac_fk" FOREIGN KEY ("assigned_gw_mac") REFERENCES "public"."gateways"("gw_mac") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;