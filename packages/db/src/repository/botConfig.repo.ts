import { eq } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { botConfig } from "@kan/db/schema";

/** Returns the single instance-level bot config row, or undefined if unset. */
export const getConfig = (db: dbClient) => {
  return db.query.botConfig.findFirst();
};

/**
 * Inserts or updates the single bot config row. `appPassword` must already be
 * encrypted by the caller. Pass `appPassword: undefined` to leave the stored
 * password unchanged (e.g. when the admin edits other fields without re-entering
 * the secret).
 */
export const upsertConfig = async (
  db: dbClient,
  data: {
    appId: string | null;
    appPassword?: string | null;
    tenantId: string | null;
    enabled: boolean;
    updatedBy: string;
  },
) => {
  const existing = await db.query.botConfig.findFirst();

  if (existing) {
    const [result] = await db
      .update(botConfig)
      .set({
        appId: data.appId,
        // Only overwrite the password when a new value is provided.
        ...(data.appPassword !== undefined
          ? { appPassword: data.appPassword }
          : {}),
        tenantId: data.tenantId,
        enabled: data.enabled,
        updatedBy: data.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(botConfig.id, existing.id))
      .returning();
    return result;
  }

  const [result] = await db
    .insert(botConfig)
    .values({
      appId: data.appId,
      appPassword: data.appPassword ?? null,
      tenantId: data.tenantId,
      enabled: data.enabled,
      updatedBy: data.updatedBy,
    })
    .returning();
  return result;
};
