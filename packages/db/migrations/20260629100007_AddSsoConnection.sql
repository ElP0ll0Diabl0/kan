CREATE TABLE IF NOT EXISTS "sso_connection" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publicId" varchar(12) NOT NULL,
	"type" varchar(16) DEFAULT 'oidc' NOT NULL,
	"providerId" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"clientId" varchar(255),
	"clientSecret" text,
	"discoveryUrl" varchar(2048),
	"scopes" varchar(512),
	"domain" varchar(255),
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	CONSTRAINT "sso_connection_publicId_unique" UNIQUE("publicId"),
	CONSTRAINT "sso_connection_providerId_unique" UNIQUE("providerId")
);
--> statement-breakpoint
ALTER TABLE "sso_connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sso_connection" ADD CONSTRAINT "sso_connection_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
