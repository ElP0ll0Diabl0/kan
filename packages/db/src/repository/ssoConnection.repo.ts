import { eq } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { ssoConnections } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export interface SsoConnectionInput {
  type: string;
  providerId: string;
  name: string;
  enabled: boolean;
  clientId: string | null;
  clientSecret?: string | null;
  discoveryUrl: string | null;
  scopes: string | null;
  domain: string | null;
}

/** Every connection, newest first (admin list). */
export const list = (db: dbClient) => {
  return db.query.ssoConnections.findMany({
    orderBy: (fields, { desc }) => [desc(fields.createdAt)],
  });
};

/** Only enabled connections — consumed by the auth handler. */
export const listEnabled = (db: dbClient) => {
  return db.query.ssoConnections.findMany({
    where: eq(ssoConnections.enabled, true),
  });
};

export const getByPublicId = (db: dbClient, publicId: string) => {
  return db.query.ssoConnections.findFirst({
    where: eq(ssoConnections.publicId, publicId),
  });
};

export const getByProviderId = (db: dbClient, providerId: string) => {
  return db.query.ssoConnections.findFirst({
    where: eq(ssoConnections.providerId, providerId),
  });
};

export const create = async (
  db: dbClient,
  data: SsoConnectionInput & { createdBy: string },
) => {
  const [result] = await db
    .insert(ssoConnections)
    .values({
      publicId: generateUID(),
      type: data.type,
      providerId: data.providerId,
      name: data.name,
      enabled: data.enabled,
      clientId: data.clientId,
      clientSecret: data.clientSecret ?? null,
      discoveryUrl: data.discoveryUrl,
      scopes: data.scopes,
      domain: data.domain,
      createdBy: data.createdBy,
    })
    .returning();
  return result;
};

/** Updates a connection. Omit `clientSecret` to leave the stored secret as-is. */
export const update = async (
  db: dbClient,
  publicId: string,
  data: Omit<SsoConnectionInput, "providerId">,
) => {
  const [result] = await db
    .update(ssoConnections)
    .set({
      type: data.type,
      name: data.name,
      enabled: data.enabled,
      clientId: data.clientId,
      ...(data.clientSecret !== undefined
        ? { clientSecret: data.clientSecret }
        : {}),
      discoveryUrl: data.discoveryUrl,
      scopes: data.scopes,
      domain: data.domain,
      updatedAt: new Date(),
    })
    .where(eq(ssoConnections.publicId, publicId))
    .returning();
  return result;
};

export const remove = async (db: dbClient, publicId: string) => {
  await db.delete(ssoConnections).where(eq(ssoConnections.publicId, publicId));
};
