import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { imports } from "./imports";
import { labels } from "./labels";
import { lists } from "./lists";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const boardVisibilityStatuses = ["private", "public"] as const;
export type BoardVisibilityStatus = (typeof boardVisibilityStatuses)[number];
export const boardVisibilityEnum = pgEnum(
  "board_visibility",
  boardVisibilityStatuses,
);

export const boardTypes = ["regular", "template"] as const;
export type BoardType = (typeof boardTypes)[number];
export const boardTypeEnum = pgEnum("board_type", boardTypes);

// Controls which workspace members can access a board. "workspace" (default)
// means the existing workspace-wide permission model applies. "restricted"
// means only explicit board members (and workspace admins) have access.
export const boardAccessLevels = ["workspace", "restricted"] as const;
export type BoardAccessLevel = (typeof boardAccessLevels)[number];
export const boardAccessLevelEnum = pgEnum(
  "board_access_level",
  boardAccessLevels,
);

export const boardMemberRoles = ["viewer", "editor", "admin"] as const;
export type BoardMemberRole = (typeof boardMemberRoles)[number];
export const boardMemberRoleEnum = pgEnum(
  "board_member_role",
  boardMemberRoles,
);

export const boards = pgTable(
  "board",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    slug: varchar("slug", { length: 255 }).notNull(),
    createdBy: uuid("createdBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
    deletedAt: timestamp("deletedAt"),
    deletedBy: uuid("deletedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    importId: bigint("importId", { mode: "number" }).references(
      () => imports.id,
    ),
    workspaceId: bigint("workspaceId", { mode: "number" })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    visibility: boardVisibilityEnum("visibility").notNull().default("private"),
    accessLevel: boardAccessLevelEnum("accessLevel")
      .notNull()
      .default("workspace"),
    type: boardTypeEnum("type").notNull().default("regular"),
    isArchived: boolean("isArchived").notNull().default(false),
    sourceBoardId: bigint("sourceBoardId", { mode: "number" }),
  },
  (table) => [
    index("board_is_archived_idx").on(table.isArchived),
    index("board_visibility_idx").on(table.visibility),
    index("board_type_idx").on(table.type),
    index("board_source_idx").on(table.sourceBoardId),
    uniqueIndex("unique_slug_per_workspace")
      .on(table.workspaceId, table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
).enableRLS();

export const boardsRelations = relations(boards, ({ one, many }) => ({
  userFavorites: many(userBoardFavorites),
  members: many(boardMembers),
  createdBy: one(users, {
    fields: [boards.createdBy],
    references: [users.id],
    relationName: "boardCreatedByUser",
  }),
  lists: many(lists),
  allLists: many(lists),
  labels: many(labels),
  deletedBy: one(users, {
    fields: [boards.deletedBy],
    references: [users.id],
    relationName: "boardDeletedByUser",
  }),
  import: one(imports, {
    fields: [boards.importId],
    references: [imports.id],
    relationName: "boardImport",
  }),
  workspace: one(workspaces, {
    fields: [boards.workspaceId],
    references: [workspaces.id],
    relationName: "boardWorkspace",
  }),
}));

export const userBoardFavorites = pgTable(
  "user_board_favorites",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boardId: bigint("boardId", { mode: "number" })
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.boardId] }),
    userIdx: index("user_board_favorite_user_idx").on(table.userId),
    boardIdx: index("user_board_favorite_board_idx").on(table.boardId),
  }),
);

// Per-board access control list. Only consulted for boards with
// accessLevel = "restricted"; see assertBoardPermission in the API layer.
export const boardMembers = pgTable(
  "board_members",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    boardId: bigint("boardId", { mode: "number" })
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: boardMemberRoleEnum("role").notNull().default("editor"),
    createdBy: uuid("createdBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
    deletedAt: timestamp("deletedAt"),
    deletedBy: uuid("deletedBy").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("unique_board_member")
      .on(table.boardId, table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("board_members_board_idx").on(table.boardId),
    index("board_members_user_idx").on(table.userId),
  ],
).enableRLS();

export const boardMembersRelations = relations(boardMembers, ({ one }) => ({
  board: one(boards, {
    fields: [boardMembers.boardId],
    references: [boards.id],
    relationName: "boardMembersBoard",
  }),
  user: one(users, {
    fields: [boardMembers.userId],
    references: [users.id],
    relationName: "boardMembersUser",
  }),
}));