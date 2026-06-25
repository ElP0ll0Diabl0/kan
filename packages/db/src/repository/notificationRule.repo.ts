import { and, eq, isNull, or } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { NotificationEventType } from "@kan/db/schema";
import { notificationRules } from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export type ResolvedRule = {
  enabled: boolean;
  teamsEnabled: boolean;
  customSubject: string | null;
  customBody: string | null;
  source: "workspace" | "global";
};

/**
 * Resolves the effective rule for every event in a workspace: a workspace row
 * overrides the global default for the same event. Events without any row are
 * absent from the map (the caller falls back to a compiled default).
 */
export const getResolvedRules = async (
  db: dbClient,
  workspaceId: number,
) => {
  const rows = await db.query.notificationRules.findMany({
    where: or(
      eq(notificationRules.workspaceId, workspaceId),
      isNull(notificationRules.workspaceId),
    ),
  });

  const resolved = new Map<NotificationEventType, ResolvedRule>();

  for (const row of rows) {
    const isWorkspaceRow = row.workspaceId !== null;
    const existing = resolved.get(row.eventType);
    // Workspace rows win over global rows.
    if (existing?.source === "workspace" && !isWorkspaceRow) continue;

    resolved.set(row.eventType, {
      enabled: row.enabled,
      teamsEnabled: row.teamsEnabled,
      customSubject: row.customSubject,
      customBody: row.customBody,
      source: isWorkspaceRow ? "workspace" : "global",
    });
  }

  return resolved;
};

export const getRule = async (
  db: dbClient,
  args: { workspaceId: number | null; eventType: NotificationEventType },
) => {
  return db.query.notificationRules.findFirst({
    where: and(
      args.workspaceId === null
        ? isNull(notificationRules.workspaceId)
        : eq(notificationRules.workspaceId, args.workspaceId),
      eq(notificationRules.eventType, args.eventType),
    ),
  });
};

export const listGlobalRules = async (db: dbClient) => {
  return db.query.notificationRules.findMany({
    where: isNull(notificationRules.workspaceId),
  });
};

export const listWorkspaceRules = async (
  db: dbClient,
  workspaceId: number,
) => {
  return db.query.notificationRules.findMany({
    where: eq(notificationRules.workspaceId, workspaceId),
  });
};

/**
 * Upserts the rule for a (workspace | global, event) pair. Uses read-then-write
 * inside a transaction because the global uniqueness is enforced by a partial
 * unique index that Drizzle's onConflictDoUpdate cannot cleanly target.
 */
export const upsertRule = async (
  db: dbClient,
  args: {
    workspaceId: number | null;
    eventType: NotificationEventType;
    enabled: boolean;
    teamsEnabled: boolean;
    customSubject: string | null;
    customBody: string | null;
    createdBy: string;
  },
) => {
  return db.transaction(async (tx) => {
    const existing = await tx.query.notificationRules.findFirst({
      columns: { id: true },
      where: and(
        args.workspaceId === null
          ? isNull(notificationRules.workspaceId)
          : eq(notificationRules.workspaceId, args.workspaceId),
        eq(notificationRules.eventType, args.eventType),
      ),
    });

    if (existing) {
      const [result] = await tx
        .update(notificationRules)
        .set({
          enabled: args.enabled,
          teamsEnabled: args.teamsEnabled,
          customSubject: args.customSubject,
          customBody: args.customBody,
          updatedAt: new Date(),
        })
        .where(eq(notificationRules.id, existing.id))
        .returning();

      return result;
    }

    const [result] = await tx
      .insert(notificationRules)
      .values({
        publicId: generateUID(),
        workspaceId: args.workspaceId,
        eventType: args.eventType,
        enabled: args.enabled,
        teamsEnabled: args.teamsEnabled,
        customSubject: args.customSubject,
        customBody: args.customBody,
        createdBy: args.createdBy,
      })
      .returning();

    return result;
  });
};

export const deleteWorkspaceRule = async (
  db: dbClient,
  args: { workspaceId: number; eventType: NotificationEventType },
) => {
  await db
    .delete(notificationRules)
    .where(
      and(
        eq(notificationRules.workspaceId, args.workspaceId),
        eq(notificationRules.eventType, args.eventType),
      ),
    );
};
