import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { ActivityType } from "@kan/db/schema";
import { cardActivities, comments } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const getCount = async (db: dbClient) => {
  const result = await db.select({ count: count() }).from(cardActivities);

  return result[0]?.count ?? 0;
};

export const create = async (
  db: dbClient,
  activityInput: {
    type: ActivityType;
    cardId: number;
    fromIndex?: number;
    toIndex?: number;
    fromListId?: number;
    toListId?: number;
    labelId?: number;
    workspaceMemberId?: number;
    fromTitle?: string;
    toTitle?: string;
    fromDescription?: string;
    toDescription?: string;
    createdBy: string;
    commentId?: number;
    fromComment?: string;
    toComment?: string;
    fromDueDate?: Date;
    toDueDate?: Date;
    sourceBoardId?: number;
    attachmentId?: number;
  },
) => {
  const [result] = await db
    .insert(cardActivities)
    .values({
      publicId: generateUID(),
      type: activityInput.type,
      cardId: activityInput.cardId,
      fromListId: activityInput.fromListId,
      toListId: activityInput.toListId,
      fromIndex: activityInput.fromIndex,
      toIndex: activityInput.toIndex,
      labelId: activityInput.labelId,
      workspaceMemberId: activityInput.workspaceMemberId,
      fromTitle: activityInput.fromTitle,
      toTitle: activityInput.toTitle,
      fromDescription: activityInput.fromDescription,
      toDescription: activityInput.toDescription,
      createdBy: activityInput.createdBy,
      commentId: activityInput.commentId,
      fromComment: activityInput.fromComment,
      toComment: activityInput.toComment,
      fromDueDate: activityInput.fromDueDate,
      toDueDate: activityInput.toDueDate,
      sourceBoardId: activityInput.sourceBoardId,
      attachmentId: activityInput.attachmentId,
    })
    .returning({ id: cardActivities.id });

  return result;
};

export const bulkCreate = async (
  db: dbClient,
  activityInputs: {
    type: ActivityType;
    cardId: number;
    fromIndex?: number;
    toIndex?: number;
    fromListId?: number;
    toListId?: number;
    labelId?: number;
    workspaceMemberId?: number;
    fromTitle?: string;
    toTitle?: string;
    fromDescription?: string;
    toDescription?: string;
    createdBy: string;
    fromDueDate?: Date;
    toDueDate?: Date;
    sourceBoardId?: number;
    attachmentId?: number;
  }[],
) => {
  const activitiesWithPublicIds = activityInputs.map((activity) => ({
    ...activity,
    publicId: generateUID(),
  }));

  const results = await db
    .insert(cardActivities)
    .values(activitiesWithPublicIds)
    .returning({ id: cardActivities.id });

  return results;
};

export const getPaginatedActivities = async (
  db: dbClient,
  cardId: number,
  options?: {
    limit?: number;
    cursor?: Date; // createdAt cursor for pagination
    // "forward" returns the oldest activities first and paginates towards
    // newer ones; "backward" returns the newest activities first (as an
    // ascending page) and paginates towards older ones.
    direction?: "forward" | "backward";
    // When true, only comment activities are returned.
    commentsOnly?: boolean;
  },
) => {
  const limit = options?.limit ?? 20;
  const cursor = options?.cursor;
  const direction = options?.direction ?? "forward";
  const commentsOnly = options?.commentsOnly ?? false;

  const validComments = await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.cardId, cardId), isNull(comments.deletedAt)));

  const validCommentIds = validComments.map((comment) => comment.id);

  const cursorCondition = cursor
    ? direction === "backward"
      ? lt(cardActivities.createdAt, cursor)
      : gt(cardActivities.createdAt, cursor)
    : undefined;

  const activities = await db.query.cardActivities.findMany({
    columns: {
      publicId: true,
      type: true,
      createdAt: true,
      fromIndex: true,
      toIndex: true,
      fromTitle: true,
      toTitle: true,
      fromDescription: true,
      toDescription: true,
      fromDueDate: true,
      toDueDate: true,
    },
    where: and(
      eq(cardActivities.cardId, cardId),
      cursorCondition,
      commentsOnly
        ? eq(cardActivities.type, "card.updated.comment.added")
        : undefined,
      or(
        isNull(cardActivities.commentId),
        inArray(cardActivities.commentId, validCommentIds),
      ),
    ),
    with: {
      fromList: {
        columns: {
          publicId: true,
          name: true,
          index: true,
        },
      },
      toList: {
        columns: {
          publicId: true,
          name: true,
          index: true,
        },
      },
      label: {
        columns: {
          publicId: true,
          name: true,
        },
      },
      member: {
        columns: {
          publicId: true,
        },
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      comment: {
        columns: {
          publicId: true,
          comment: true,
          createdBy: true,
          updatedAt: true,
          deletedAt: true,
        },
      },
      attachment: {
        columns: {
          publicId: true,
          filename: true,
          originalFilename: true,
        },
      },
    },
    // Backward pagination fetches newest-first, then we reverse the page so
    // the returned array is always ascending (required for merging).
    orderBy:
      direction === "backward"
        ? desc(cardActivities.createdAt)
        : asc(cardActivities.createdAt),
    limit: limit + 1, // fetch one extra to check if there are more
  });

  const hasMore = activities.length > limit;
  const page = activities.slice(0, limit);
  const items = direction === "backward" ? page.reverse() : page;

  // For forward pagination the next cursor is the newest item in the page
  // (fetch newer next); for backward it is the oldest item (fetch older next).
  const nextCursor = hasMore
    ? direction === "backward"
      ? items[0]?.createdAt
      : items[items.length - 1]?.createdAt
    : undefined;

  return {
    activities: items,
    hasMore,
    nextCursor,
  };
};

export type PaginatedActivitiesResult = Awaited<
  ReturnType<typeof getPaginatedActivities>
>;
