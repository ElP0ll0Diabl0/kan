ALTER TYPE "public"."notification_type" ADD VALUE 'card.checklist.item.assigned' BEFORE 'board.access.granted';--> statement-breakpoint
ALTER TYPE "public"."notification_event_type" ADD VALUE 'card.checklist.item.assigned' BEFORE 'mention';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_checklist_item_workspace_members" (
	"checklistItemId" bigint NOT NULL,
	"workspaceMemberId" bigint NOT NULL,
	CONSTRAINT "_checklist_item_workspace_members_checklistItemId_workspaceMemberId_pk" PRIMARY KEY("checklistItemId","workspaceMemberId")
);
--> statement-breakpoint
ALTER TABLE "_checklist_item_workspace_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_checklist_item_workspace_members" ADD CONSTRAINT "_checklist_item_workspace_members_checklistItemId_card_checklist_item_id_fk" FOREIGN KEY ("checklistItemId") REFERENCES "public"."card_checklist_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_checklist_item_workspace_members" ADD CONSTRAINT "_checklist_item_workspace_members_workspaceMemberId_workspace_members_id_fk" FOREIGN KEY ("workspaceMemberId") REFERENCES "public"."workspace_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
