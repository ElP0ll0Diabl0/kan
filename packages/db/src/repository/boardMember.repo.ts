import { and, desc, eq, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { BoardMemberRole } from "@kan/db/schema";
import { boardMembers } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

/** Active board membership for a (board, user) pair, if any. */
export const getByBoardAndUser = (
  db: dbClient,
  boardId: number,
  userId: string,
) => {
  return db.query.boardMembers.findFirst({
    columns: { id: true, publicId: true, role: true },
    where: and(
      eq(boardMembers.boardId, boardId),
      eq(boardMembers.userId, userId),
      isNull(boardMembers.deletedAt),
    ),
  });
};

export const getByPublicId = (db: dbClient, publicId: string) => {
  return db.query.boardMembers.findFirst({
    where: eq(boardMembers.publicId, publicId),
  });
};

export const listByBoard = (db: dbClient, boardId: number) => {
  return db.query.boardMembers.findMany({
    columns: { publicId: true, role: true, createdAt: true },
    where: and(
      eq(boardMembers.boardId, boardId),
      isNull(boardMembers.deletedAt),
    ),
    with: {
      user: {
        columns: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: desc(boardMembers.createdAt),
  });
};

export const create = async (
  db: dbClient,
  input: {
    boardId: number;
    userId: string;
    role: BoardMemberRole;
    createdBy: string;
  },
) => {
  const [result] = await db
    .insert(boardMembers)
    .values({
      publicId: generateUID(),
      boardId: input.boardId,
      userId: input.userId,
      role: input.role,
      createdBy: input.createdBy,
    })
    .returning({ id: boardMembers.id, publicId: boardMembers.publicId });

  return result;
};

export const updateRole = async (
  db: dbClient,
  args: { boardMemberId: number; role: BoardMemberRole },
) => {
  const [result] = await db
    .update(boardMembers)
    .set({ role: args.role, updatedAt: new Date() })
    .where(eq(boardMembers.id, args.boardMemberId))
    .returning({ id: boardMembers.id, role: boardMembers.role });

  return result;
};

export const softDelete = async (
  db: dbClient,
  args: { boardMemberId: number; deletedAt: Date; deletedBy: string },
) => {
  const [result] = await db
    .update(boardMembers)
    .set({ deletedAt: args.deletedAt, deletedBy: args.deletedBy })
    .where(
      and(
        eq(boardMembers.id, args.boardMemberId),
        isNull(boardMembers.deletedAt),
      ),
    )
    .returning({ id: boardMembers.id });

  return result;
};
