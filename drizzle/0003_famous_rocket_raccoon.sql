CREATE TABLE "asset_map_gateways" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"map_id" varchar(50) NOT NULL,
	"gw_mac" varchar(17) NOT NULL,
	"x_percent" numeric(7, 4) NOT NULL,
	"y_percent" numeric(7, 4) NOT NULL,
	"width_percent" numeric(7, 4) DEFAULT '10' NOT NULL,
	"height_percent" numeric(7, 4) DEFAULT '8' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_maps" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"company_id" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"image_path" varchar(512) NOT NULL,
	"image_width" integer NOT NULL,
	"image_height" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_map_gateways" ADD CONSTRAINT "asset_map_gateways_map_id_asset_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."asset_maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_map_gateways" ADD CONSTRAINT "asset_map_gateways_gw_mac_gateways_gw_mac_fk" FOREIGN KEY ("gw_mac") REFERENCES "public"."gateways"("gw_mac") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_maps" ADD CONSTRAINT "asset_maps_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;