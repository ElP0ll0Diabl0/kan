CREATE TABLE IF NOT EXISTS "teams_conversation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publicId" varchar(12) NOT NULL,
	"userId" uuid NOT NULL,
	"aadObjectId" varchar(255) NOT NULL,
	"tenantId" varchar(255),
	"serviceUrl" varchar(2048),
	"conversationReference" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	CONSTRAINT "teams_conversation_publicId_unique" UNIQUE("publicId"),
	CONSTRAINT "teams_conversation_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "teams_conversation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "entraObjectId" varchar(255);--> statement-breakpoint
ALTER TABLE "notification_rule" ADD COLUMN "teamsEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teams_conversation" ADD CONSTRAINT "teams_conversation_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_conversation_aad_idx" ON "teams_conversation" USING btree ("aadObjectId");