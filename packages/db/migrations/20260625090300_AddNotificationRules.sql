CREATE TYPE "public"."notification_event_type" AS ENUM('card.created', 'card.updated', 'card.moved', 'card.deleted', 'card.comment.added', 'card.member.added', 'card.member.removed', 'mention', 'workspace.member.added', 'workspace.member.removed', 'workspace.role.changed', 'board.access.granted');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'card.created';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'card.updated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'card.moved';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'card.deleted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'card.comment.added';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'card.member.added';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'card.member.removed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'board.access.granted';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_rule" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publicId" varchar(12) NOT NULL,
	"workspaceId" bigint,
	"eventType" "notification_event_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"customSubject" varchar(255),
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	CONSTRAINT "notification_rule_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
ALTER TABLE "notification_rule" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "emailUnsubscribedAt" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_rule" ADD CONSTRAINT "notification_rule_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_rule" ADD CONSTRAINT "notification_rule_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rule_ws_event_idx" ON "notification_rule" USING btree ("workspaceId","eventType");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rule_global_event_idx" ON "notification_rule" USING btree ("eventType") WHERE "workspaceId" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_rule_workspace_idx" ON "notification_rule" USING btree ("workspaceId");