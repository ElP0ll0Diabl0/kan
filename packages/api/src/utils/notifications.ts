import { env } from "next-runtime-env";

import type { dbClient } from "@kan/db/client";
import type { NotificationEventType, NotificationType } from "@kan/db/schema";
import { createLogger } from "@kan/logger";

const log = createLogger("notifications");
import * as cardRepo from "@kan/db/repository/card.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as notificationRepo from "@kan/db/repository/notification.repo";
import * as notificationRuleRepo from "@kan/db/repository/notificationRule.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";
import type { Templates } from "@kan/email";
import { sendEmail } from "@kan/email";
import { createEmailUnsubscribeLink, parseMentionsFromHTML } from "@kan/shared/utils";

import { substituteTokens } from "./notificationPlaceholders";

/**
 * Effective default when no rule row exists. Events that already send email
 * today (mention, added-to-workspace, board access) stay ON; brand-new events
 * default OFF so enabling the feature never floods users — admins opt in.
 */
export const EVENT_DEFAULT_ENABLED: Record<NotificationEventType, boolean> = {
  mention: true,
  "workspace.member.added": true,
  "board.access.granted": true,
  "card.created": false,
  "card.updated": false,
  "card.moved": false,
  "card.deleted": false,
  "card.comment.added": false,
  "card.member.added": false,
  "card.member.removed": false,
  "workspace.member.removed": false,
  "workspace.role.changed": false,
};

const TEMPLATE_FOR: Record<NotificationEventType, Templates> = {
  mention: "MENTION",
  "card.created": "CARD_CREATED",
  "card.updated": "CARD_UPDATED",
  "card.moved": "CARD_UPDATED",
  "card.deleted": "CARD_DELETED",
  "card.comment.added": "CARD_COMMENT",
  "card.member.added": "CARD_ASSIGNED",
  "card.member.removed": "CARD_UNASSIGNED",
  "workspace.member.added": "ADDED_TO_WORKSPACE",
  "workspace.member.removed": "WORKSPACE_MEMBER_REMOVED",
  "workspace.role.changed": "WORKSPACE_ROLE_CHANGED",
  "board.access.granted": "BOARD_ACCESS",
};

export interface NotificationRecipient {
  userId: string;
  email: string;
  name: string;
}

export type DispatchArgs =
  | {
      event: "mention";
      actorUserId: string;
      cardPublicId: string;
      commentHtml: string;
      commentId?: number;
    }
  | {
      event: "card.comment.added";
      actorUserId: string;
      cardPublicId: string;
      commentId: number;
      commentExcerpt?: string;
    }
  | { event: "card.created"; actorUserId: string; cardPublicId: string }
  | {
      event: "card.updated" | "card.moved";
      actorUserId: string;
      cardPublicId: string;
      changeSummary?: string;
    }
  | {
      event: "card.member.added" | "card.member.removed";
      actorUserId: string;
      cardPublicId: string;
      targetWorkspaceMemberId: number;
    }
  | {
      event: "card.deleted";
      actorUserId: string;
      workspaceId: number;
      cardTitle: string;
      boardName: string;
      recipients: NotificationRecipient[];
    }
  | {
      event: "workspace.member.added";
      actorUserId: string;
      workspaceId: number;
      targetUserId: string;
      workspaceName: string;
      inviterName?: string;
      boards?: string;
      ctaUrl?: string;
      ctaLabel?: string;
    }
  | {
      event: "workspace.member.removed";
      actorUserId: string;
      workspaceId: number;
      targetUserId: string;
      workspaceName: string;
      actorName?: string;
    }
  | {
      event: "workspace.role.changed";
      actorUserId: string;
      workspaceId: number;
      targetUserId: string;
      workspaceName: string;
      newRole: string;
      actorName?: string;
    }
  | {
      event: "board.access.granted";
      actorUserId: string;
      workspaceId: number;
      targetUserId: string;
      boardName: string;
      boardUrl?: string;
      actorName?: string;
    };

/** Internal: everything needed to send a notification, minus the resolved subject. */
interface DispatchContext {
  workspaceId: number;
  recipients: NotificationRecipient[];
  template: Templates;
  defaultSubject: string;
  data: Record<string, string>;
  ledgerType: NotificationType;
  cardId?: number;
  commentId?: number;
  /** When true, skip recipients with an existing ledger row of this type. */
  dedupe: boolean;
}

/**
 * Resolves the effective rule for an event in a workspace: workspace row wins
 * over the global row, and the compiled per-event default applies when neither
 * exists.
 */
export async function resolveRule(
  db: dbClient,
  workspaceId: number,
  event: NotificationEventType,
): Promise<{
  enabled: boolean;
  customSubject: string | null;
  customBody: string | null;
}> {
  const resolved = await notificationRuleRepo.getResolvedRules(db, workspaceId);
  const rule = resolved.get(event);

  if (!rule) {
    return {
      enabled: EVENT_DEFAULT_ENABLED[event],
      customSubject: null,
      customBody: null,
    };
  }

  return {
    enabled: rule.enabled,
    customSubject: rule.customSubject,
    customBody: rule.customBody,
  };
}

async function resolveUserRecipient(
  db: dbClient,
  userId: string,
): Promise<NotificationRecipient | null> {
  const user = await userRepo.getById(db, userId);
  if (!user?.email) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name?.trim() || user.email,
  };
}

async function getActorName(db: dbClient, actorUserId: string): Promise<string> {
  const actor = await userRepo.getById(db, actorUserId);
  return actor?.name?.trim() || actor?.email || "Someone";
}

/** Loads a card's board/workspace context plus its assigned-member recipients. */
async function buildCardContext(db: dbClient, cardPublicId: string) {
  const card = await cardRepo.getWithListAndMembersByPublicId(db, cardPublicId);
  if (!card?.list.board) return null;

  const board = card.list.board;
  const workspace = await workspaceRepo.getByPublicId(db, board.workspace.publicId);
  if (!workspace?.id) return null;

  const baseUrl = env("NEXT_PUBLIC_BASE_URL");

  const assignedMembers = card.members
    .map((m): NotificationRecipient | null => {
      const userId = m.user?.id;
      const email = m.email;
      if (!userId || !email) return null;
      return { userId, email, name: m.user?.name?.trim() || email };
    })
    .filter((r): r is NotificationRecipient => r !== null);

  return {
    workspaceId: workspace.id,
    cardId: card.id,
    cardTitle: card.title,
    boardName: board.name,
    cardUrl: `${baseUrl}/cards/${card.publicId}`,
    assignedMembers,
  };
}

/** Resolves the per-event recipients, template, data and dedup config. */
async function resolveContext(
  db: dbClient,
  args: DispatchArgs,
): Promise<DispatchContext | null> {
  switch (args.event) {
    case "mention": {
      const mentionPublicIds = parseMentionsFromHTML(args.commentHtml);
      if (mentionPublicIds.length === 0) return null;

      const ctx = await buildCardContext(db, args.cardPublicId);
      if (!ctx) return null;

      const actorName = await getActorName(db, args.actorUserId);
      const members = await memberRepo.getByPublicIdsWithUsers(
        db,
        mentionPublicIds,
        ctx.workspaceId,
      );
      const recipients = members
        .map((m): NotificationRecipient | null => {
          const userId = m.user?.id;
          const email = m.user?.email ?? m.email;
          if (!userId || !email) return null;
          return { userId, email, name: m.user?.name?.trim() || email };
        })
        .filter((r): r is NotificationRecipient => r !== null);

      return {
        workspaceId: ctx.workspaceId,
        recipients,
        template: TEMPLATE_FOR.mention,
        defaultSubject: `${actorName} mentioned you in a comment on ${ctx.cardTitle}`,
        data: {
          commenterName: actorName,
          boardName: ctx.boardName,
          cardTitle: ctx.cardTitle,
          cardUrl: ctx.cardUrl,
        },
        ledgerType: "mention",
        cardId: ctx.cardId,
        commentId: args.commentId,
        dedupe: true,
      };
    }

    case "card.comment.added": {
      const ctx = await buildCardContext(db, args.cardPublicId);
      if (!ctx) return null;
      const actorName = await getActorName(db, args.actorUserId);

      return {
        workspaceId: ctx.workspaceId,
        recipients: ctx.assignedMembers,
        template: TEMPLATE_FOR["card.comment.added"],
        defaultSubject: `${actorName} commented on ${ctx.cardTitle}`,
        data: {
          actorName,
          cardTitle: ctx.cardTitle,
          boardName: ctx.boardName,
          cardUrl: ctx.cardUrl,
          commentExcerpt: args.commentExcerpt ?? "",
        },
        ledgerType: "card.comment.added",
        cardId: ctx.cardId,
        commentId: args.commentId,
        dedupe: false,
      };
    }

    case "card.created": {
      const ctx = await buildCardContext(db, args.cardPublicId);
      if (!ctx) return null;
      const actorName = await getActorName(db, args.actorUserId);

      return {
        workspaceId: ctx.workspaceId,
        recipients: ctx.assignedMembers,
        template: TEMPLATE_FOR["card.created"],
        defaultSubject: `New card: ${ctx.cardTitle}`,
        data: {
          actorName,
          cardTitle: ctx.cardTitle,
          boardName: ctx.boardName,
          cardUrl: ctx.cardUrl,
        },
        ledgerType: "card.created",
        cardId: ctx.cardId,
        dedupe: true,
      };
    }

    case "card.updated":
    case "card.moved": {
      const ctx = await buildCardContext(db, args.cardPublicId);
      if (!ctx) return null;
      const actorName = await getActorName(db, args.actorUserId);
      const moved = args.event === "card.moved";

      return {
        workspaceId: ctx.workspaceId,
        recipients: ctx.assignedMembers,
        template: TEMPLATE_FOR[args.event],
        defaultSubject: moved
          ? `${ctx.cardTitle} was moved`
          : `${ctx.cardTitle} was updated`,
        data: {
          actorName,
          cardTitle: ctx.cardTitle,
          boardName: ctx.boardName,
          cardUrl: ctx.cardUrl,
          changeSummary: args.changeSummary ?? "",
        },
        ledgerType: args.event,
        cardId: ctx.cardId,
        // One notification per mutation; no permanent suppression.
        dedupe: false,
      };
    }

    case "card.member.added":
    case "card.member.removed": {
      const ctx = await buildCardContext(db, args.cardPublicId);
      if (!ctx) return null;
      const actorName = await getActorName(db, args.actorUserId);

      const member = await memberRepo.getById(db, args.targetWorkspaceMemberId);
      if (!member?.userId) return null;
      const recipient = await resolveUserRecipient(db, member.userId);
      if (!recipient) return null;

      const added = args.event === "card.member.added";
      return {
        workspaceId: ctx.workspaceId,
        recipients: [recipient],
        template: TEMPLATE_FOR[args.event],
        defaultSubject: added
          ? `You were assigned to ${ctx.cardTitle}`
          : `You were removed from ${ctx.cardTitle}`,
        data: {
          actorName,
          cardTitle: ctx.cardTitle,
          boardName: ctx.boardName,
          cardUrl: ctx.cardUrl,
        },
        ledgerType: args.event,
        cardId: ctx.cardId,
        dedupe: false,
      };
    }

    case "card.deleted": {
      const actorName = await getActorName(db, args.actorUserId);
      return {
        workspaceId: args.workspaceId,
        recipients: args.recipients,
        template: TEMPLATE_FOR["card.deleted"],
        defaultSubject: `${args.cardTitle} was deleted`,
        data: {
          actorName,
          cardTitle: args.cardTitle,
          boardName: args.boardName,
        },
        ledgerType: "card.deleted",
        dedupe: false,
      };
    }

    case "workspace.member.added": {
      const recipient = await resolveUserRecipient(db, args.targetUserId);
      if (!recipient) return null;
      return {
        workspaceId: args.workspaceId,
        recipients: [recipient],
        template: TEMPLATE_FOR["workspace.member.added"],
        defaultSubject: `You've been added to ${args.workspaceName}`,
        data: {
          workspaceName: args.workspaceName,
          inviterName: args.inviterName ?? "",
          boards: args.boards ?? "",
          ctaUrl: args.ctaUrl ?? "",
          ctaLabel: args.ctaLabel ?? "",
        },
        ledgerType: "workspace.member.added",
        dedupe: false,
      };
    }

    case "workspace.member.removed": {
      const recipient = await resolveUserRecipient(db, args.targetUserId);
      if (!recipient) return null;
      return {
        workspaceId: args.workspaceId,
        recipients: [recipient],
        template: TEMPLATE_FOR["workspace.member.removed"],
        defaultSubject: `You've been removed from ${args.workspaceName}`,
        data: {
          workspaceName: args.workspaceName,
          actorName: args.actorName ?? "",
        },
        ledgerType: "workspace.member.removed",
        dedupe: false,
      };
    }

    case "workspace.role.changed": {
      const recipient = await resolveUserRecipient(db, args.targetUserId);
      if (!recipient) return null;
      return {
        workspaceId: args.workspaceId,
        recipients: [recipient],
        template: TEMPLATE_FOR["workspace.role.changed"],
        defaultSubject: `Your role in ${args.workspaceName} changed`,
        data: {
          workspaceName: args.workspaceName,
          newRole: args.newRole,
          actorName: args.actorName ?? "",
        },
        ledgerType: "workspace.role.changed",
        dedupe: false,
      };
    }

    case "board.access.granted": {
      const recipient = await resolveUserRecipient(db, args.targetUserId);
      if (!recipient) return null;
      return {
        workspaceId: args.workspaceId,
        recipients: [recipient],
        template: TEMPLATE_FOR["board.access.granted"],
        defaultSubject: `You've been granted access to ${args.boardName}`,
        data: {
          boardName: args.boardName,
          boardUrl: args.boardUrl ?? "",
          actorName: args.actorName ?? "",
        },
        ledgerType: "board.access.granted",
        dedupe: false,
      };
    }
  }
}

/**
 * Central notification dispatcher. Resolves the effective rule (workspace →
 * global → compiled default), the per-event recipients, dedupes via the
 * notification ledger, honours per-user unsubscribe, and sends the built-in
 * template — all best-effort. Always call fire-and-forget (`.catch(...)`); it
 * never throws so it can't break the originating mutation.
 */
export async function dispatchNotification(
  db: dbClient,
  args: DispatchArgs,
): Promise<void> {
  try {
    const ctx = await resolveContext(db, args);
    if (!ctx) return;

    const recipients = ctx.recipients.filter(
      (r) => r.userId !== args.actorUserId,
    );
    if (recipients.length === 0) return;

    const rule = await resolveRule(db, ctx.workspaceId, args.event);
    if (!rule.enabled) {
      log.debug({ event: args.event, workspaceId: ctx.workspaceId }, "Notification disabled by rule");
      return;
    }

    // {{tokens}} in custom subject/body are substituted from the event's
    // data object before delivery. customBody !=null switches the dispatch
    // to the CUSTOM_CONTENT template so the admin's HTML is the body.
    //
    // The subject substitution happens once (no per-recipient data in the
    // subject). The body substitution defers to inside the recipient loop
    // because we want {{unsubscribeUrl}} to resolve to a per-recipient JWT
    // link, not the event-shared template.
    const subjectTemplate = rule.customSubject?.trim() || ctx.defaultSubject;
    const subject = substituteTokens(subjectTemplate, ctx.data);
    const customBodyTemplate =
      (rule.customBody?.trim().length ?? 0) > 0 ? rule.customBody : null;

    log.info(
      { event: args.event, recipientCount: recipients.length, workspaceId: ctx.workspaceId },
      "Dispatching notification",
    );

    await Promise.all(
      recipients.map(async (recipient) => {
        try {
          if (await userRepo.isEmailUnsubscribed(db, recipient.userId)) {
            return;
          }

          if (ctx.dedupe) {
            const alreadySent = await notificationRepo.exists(db, {
              userId: recipient.userId,
              type: ctx.ledgerType,
              cardId: ctx.cardId,
              workspaceId: ctx.cardId ? undefined : ctx.workspaceId,
            });
            if (alreadySent) return;
          }

          await notificationRepo.create(db, {
            type: ctx.ledgerType,
            userId: recipient.userId,
            cardId: ctx.cardId,
            commentId: ctx.commentId,
            workspaceId: ctx.cardId ? undefined : ctx.workspaceId,
          });

          const unsubscribeUrl =
            (await createEmailUnsubscribeLink(recipient.userId)) ?? "";

          if (customBodyTemplate !== null) {
            // Substitute per-recipient (the only field that varies is
            // unsubscribeUrl). All other tokens already resolved from ctx.data.
            const customBodyHtml = substituteTokens(customBodyTemplate, {
              ...ctx.data,
              unsubscribeUrl,
            });
            await sendEmail(recipient.email, subject, "CUSTOM_CONTENT", {
              heading: subject,
              bodyHtml: customBodyHtml,
              unsubscribeUrl,
            });
          } else {
            await sendEmail(recipient.email, subject, ctx.template, {
              ...ctx.data,
              unsubscribeUrl,
            });
          }

          log.info({ event: args.event, email: recipient.email }, "Notification email sent");
        } catch (error) {
          log.error(
            { err: error, event: args.event, email: recipient.email },
            "Failed to send notification email",
          );
        }
      }),
    );
  } catch (error) {
    log.error({ err: error, event: args.event }, "Error dispatching notification");
  }
}

/**
 * Backward-compatible wrapper so existing call sites keep working — routes
 * @mentions through the central dispatcher.
 */
export async function sendMentionEmails({
  db,
  cardPublicId,
  commentHtml,
  commenterUserId,
  commentId,
}: {
  db: dbClient;
  cardPublicId: string;
  commentHtml: string;
  commenterUserId: string;
  commentId?: number;
}) {
  return dispatchNotification(db, {
    event: "mention",
    actorUserId: commenterUserId,
    cardPublicId,
    commentHtml,
    commentId,
  });
}
