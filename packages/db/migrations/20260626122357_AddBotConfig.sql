CREATE TABLE IF NOT EXISTS "bot_config" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"appId" varchar(255),
	"appPassword" text,
	"tenantId" varchar(255),
	"enabled" boolean DEFAULT false NOT NULL,
	"updatedBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "bot_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bot_config" ADD CONSTRAINT "bot_config_updatedBy_user_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
