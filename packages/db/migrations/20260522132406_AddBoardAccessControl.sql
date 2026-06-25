CREATE TYPE "public"."board_access_level" AS ENUM('workspace', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."board_member_role" AS ENUM('viewer', 'editor', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "board_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publicId" varchar(12) NOT NULL,
	"boardId" bigint NOT NULL,
	"userId" uuid NOT NULL,
	"role" "board_member_role" DEFAULT 'editor' NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"deletedAt" timestamp,
	"deletedBy" uuid,
	CONSTRAINT "board_members_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
ALTER TABLE "board_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "accessLevel" "board_access_level" DEFAULT 'workspace' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_members" ADD CONSTRAINT "board_members_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_members" ADD CONSTRAINT "board_members_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_members" ADD CONSTRAINT "board_members_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_members" ADD CONSTRAINT "board_members_deletedBy_user_id_fk" FOREIGN KEY ("deletedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_board_member" ON "board_members" USING btree ("boardId","userId") WHERE "board_members"."deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_members_board_idx" ON "board_members" USING btree ("boardId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_members_user_idx" ON "board_members" USING btree ("userId");