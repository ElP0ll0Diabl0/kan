import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";
import { workspaces } from "./workspaces";

// The full catalog of events an admin can manage. Kept separate from
// `notification_type` (the per-recipient dedup ledger) because this is the
// rule catalog, not the ledger of sent notifications.
export const notificationEventTypes = [
  "card.created",
  "card.updated",
  "card.moved",
  "card.deleted",
  "card.comment.added",
  "card.member.added",
  "card.member.removed",
  "mention",
  "workspace.member.added",
  "workspace.member.removed",
  "workspace.role.changed",
  "board.access.granted",
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

export const notificationEventTypeEnum = pgEnum(
  "notification_event_type",
  notificationEventTypes,
);

export const notificationRules = pgTable(
  "notification_rule",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    // null = global default; set = per-workspace override.
    workspaceId: bigint("workspaceId", { mode: "number" }).references(
      () => workspaces.id,
      { onDelete: "cascade" },
    ),
    eventType: notificationEventTypeEnum("eventType").notNull(),
    // `enabled` gates the email channel (kept for backwards compatibility);
    // `teamsEnabled` gates the Microsoft Teams channel.
    enabled: boolean("enabled").notNull().default(true),
    teamsEnabled: boolean("teamsEnabled").notNull().default(false),
    customSubject: varchar("customSubject", { length: 255 }),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    // Per-workspace uniqueness. Postgres treats NULLs as distinct, so this does
    // not constrain global rows (workspaceId IS NULL).
    uniqueIndex("notification_rule_ws_event_idx").on(
      table.workspaceId,
      table.eventType,
    ),
    // Enforce exactly one GLOBAL row per event via a partial unique index over
    // the rows where workspaceId IS NULL.
    uniqueIndex("notification_rule_global_event_idx")
      .on(table.eventType)
      .where(sql`"workspaceId" IS NULL`),
    index("notification_rule_workspace_idx").on(table.workspaceId),
  ],
).enableRLS();

export const notificationRulesRelations = relations(
  notificationRules,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [notificationRules.workspaceId],
      references: [workspaces.id],
      relationName: "notificationRulesWorkspace",
    }),
    createdByUser: one(users, {
      fields: [notificationRules.createdBy],
      references: [users.id],
      relationName: "notificationRulesCreatedByUser",
    }),
  }),
);
