import { eq } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { BoardMemberRole } from "@kan/db/schema";
import { pendingBoardMembers } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

/**
 * Parks the board access grants for an invited (not-yet-registered) member.
 * Applied to board_members once the invite is accepted.
 */
export const createMany = async (
  db: dbClient,
  input: {
    workspaceMemberId: number;
    createdBy: string;
    boards: { boardId: number; role: BoardMemberRole }[];
  },
) => {
  if (input.boards.length === 0) return;

  await db
    .insert(pendingBoardMembers)
    .values(
      input.boards.map((board) => ({
        publicId: generateUID(),
        workspaceMemberId: input.workspaceMemberId,
        boardId: board.boardId,
        role: board.role,
        createdBy: input.createdBy,
      })),
    )
    .onConflictDoNothing({
      target: [
        pendingBoardMembers.workspaceMemberId,
        pendingBoardMembers.boardId,
      ],
    });
};

export const listByWorkspaceMemberId = (
  db: dbClient,
  workspaceMemberId: number,
) => {
  return db.query.pendingBoardMembers.findMany({
    columns: { id: true, boardId: true, role: true },
    where: eq(pendingBoardMembers.workspaceMemberId, workspaceMemberId),
  });
};

export const deleteByWorkspaceMemberId = async (
  db: dbClient,
  workspaceMemberId: number,
) => {
  await db
    .delete(pendingBoardMembers)
    .where(eq(pendingBoardMembers.workspaceMemberId, workspaceMemberId));
};
