import { relations } from "drizzle-orm";
import {
  bigserial,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

// One row per user who has connected the Teams bot. Stores the serialized Bot
// Framework ConversationReference used for proactive (outbound) notifications.
export const teamsConversations = pgTable(
  "teams_conversation",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    userId: uuid("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    aadObjectId: varchar("aadObjectId", { length: 255 }).notNull(),
    tenantId: varchar("tenantId", { length: 255 }),
    serviceUrl: varchar("serviceUrl", { length: 2048 }),
    conversationReference: text("conversationReference").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [index("teams_conversation_aad_idx").on(table.aadObjectId)],
).enableRLS();

export const teamsConversationsRelations = relations(
  teamsConversations,
  ({ one }) => ({
    user: one(users, {
      fields: [teamsConversations.userId],
      references: [users.id],
      relationName: "teamsConversationsUser",
    }),
  }),
);
