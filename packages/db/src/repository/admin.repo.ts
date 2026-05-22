import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { boards, users, workspaceMembers, workspaces } from "@kan/db/schema";

interface ListArgs {
  limit: number;
  offset: number;
  search?: string;
}

/**
 * Lists every workspace on the instance with member and board counts.
 * Intended for the instance admin area only.
 */
export const listWorkspaces = async (
  db: dbClient,
  { limit, offset, search }: ListArgs,
) => {
  const where = and(
    isNull(workspaces.deletedAt),
    search ? ilike(workspaces.name, `%${search}%`) : undefined,
  );

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        publicId: workspaces.publicId,
        name: workspaces.name,
        slug: workspaces.slug,
        plan: workspaces.plan,
        createdAt: workspaces.createdAt,
        memberCount: sql<number>`cast(count(distinct ${workspaceMembers.id}) as int)`,
        boardCount: sql<number>`cast(count(distinct ${boards.id}) as int)`,
      })
      .from(workspaces)
      .leftJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, workspaces.id),
          isNull(workspaceMembers.deletedAt),
        ),
      )
      .leftJoin(
        boards,
        and(eq(boards.workspaceId, workspaces.id), isNull(boards.deletedAt)),
      )
      .where(where)
      .groupBy(workspaces.id)
      .orderBy(desc(workspaces.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(workspaces).where(where),
  ]);

  return { workspaces: rows, total: totalResult[0]?.count ?? 0 };
};

/**
 * Returns a single workspace with all of its boards and members.
 */
export const getWorkspaceOverview = (
  db: dbClient,
  workspacePublicId: string,
) => {
  return db.query.workspaces.findFirst({
    columns: {
      publicId: true,
      name: true,
      slug: true,
      description: true,
      plan: true,
      createdAt: true,
    },
    with: {
      boards: {
        columns: {
          publicId: true,
          name: true,
          slug: true,
          visibility: true,
          type: true,
          isArchived: true,
          createdAt: true,
        },
        where: isNull(boards.deletedAt),
        orderBy: desc(boards.createdAt),
      },
      members: {
        columns: {
          publicId: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
        where: isNull(workspaceMembers.deletedAt),
        with: {
          user: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
    where: and(
      eq(workspaces.publicId, workspacePublicId),
      isNull(workspaces.deletedAt),
    ),
  });
};

/**
 * Lists every user account on the instance with a count of the workspaces
 * they belong to.
 */
export const listUsers = async (
  db: dbClient,
  { limit, offset, search }: ListArgs,
) => {
  const where = search
    ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
    : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
        banned: users.banned,
        createdAt: users.createdAt,
        workspaceCount: sql<number>`cast(count(distinct ${workspaceMembers.id}) as int)`,
      })
      .from(users)
      .leftJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.userId, users.id),
          isNull(workspaceMembers.deletedAt),
        ),
      )
      .where(where)
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(users).where(where),
  ]);

  return { users: rows, total: totalResult[0]?.count ?? 0 };
};

/**
 * Returns a single user with every workspace membership they hold.
 */
export const getUserOverview = async (db: dbClient, userId: string) => {
  const user = await db.query.users.findFirst({
    columns: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      banned: true,
      banReason: true,
      banExpires: true,
      createdAt: true,
    },
    where: eq(users.id, userId),
  });

  if (!user) return undefined;

  const memberships = await db.query.workspaceMembers.findMany({
    columns: {
      publicId: true,
      role: true,
      status: true,
      createdAt: true,
    },
    where: and(
      eq(workspaceMembers.userId, userId),
      isNull(workspaceMembers.deletedAt),
    ),
    with: {
      workspace: {
        columns: { publicId: true, name: true, slug: true, plan: true },
      },
    },
    orderBy: desc(workspaceMembers.createdAt),
  });

  return { ...user, memberships };
};
