CREATE TABLE IF NOT EXISTS "pending_board_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publicId" varchar(12) NOT NULL,
	"workspaceMemberId" bigint NOT NULL,
	"boardId" bigint NOT NULL,
	"role" "board_member_role" DEFAULT 'editor' NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_board_members_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
ALTER TABLE "pending_board_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_board_members" ADD CONSTRAINT "pending_board_members_workspaceMemberId_workspace_members_id_fk" FOREIGN KEY ("workspaceMemberId") REFERENCES "public"."workspace_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_board_members" ADD CONSTRAINT "pending_board_members_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_board_members" ADD CONSTRAINT "pending_board_members_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_pending_board_member" ON "pending_board_members" USING btree ("workspaceMemberId","boardId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_board_members_member_idx" ON "pending_board_members" USING btree ("workspaceMemberId");