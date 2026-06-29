import { eq } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { teamsConversations } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const getByUserId = (db: dbClient, userId: string) => {
  return db.query.teamsConversations.findFirst({
    where: eq(teamsConversations.userId, userId),
  });
};

export const getByAadObjectId = (db: dbClient, aadObjectId: string) => {
  return db.query.teamsConversations.findFirst({
    where: eq(teamsConversations.aadObjectId, aadObjectId),
  });
};

/** Lists every linked Teams conversation with its user (for the admin view). */
export const listConnections = (db: dbClient) => {
  return db.query.teamsConversations.findMany({
    columns: {
      publicId: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      user: { columns: { name: true, email: true } },
    },
    orderBy: (fields, { desc }) => [desc(fields.createdAt)],
  });
};

/** Inserts or refreshes the conversation reference for a user (one per user). */
export const upsertByUserId = async (
  db: dbClient,
  data: {
    userId: string;
    aadObjectId: string;
    tenantId?: string | null;
    serviceUrl?: string | null;
    conversationReference: string;
  },
) => {
  const [result] = await db
    .insert(teamsConversations)
    .values({
      publicId: generateUID(),
      userId: data.userId,
      aadObjectId: data.aadObjectId,
      tenantId: data.tenantId,
      serviceUrl: data.serviceUrl,
      conversationReference: data.conversationReference,
    })
    .onConflictDoUpdate({
      target: teamsConversations.userId,
      set: {
        aadObjectId: data.aadObjectId,
        tenantId: data.tenantId,
        serviceUrl: data.serviceUrl,
        conversationReference: data.conversationReference,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
};

export const deleteByUserId = async (db: dbClient, userId: string) => {
  await db
    .delete(teamsConversations)
    .where(eq(teamsConversations.userId, userId));
};
