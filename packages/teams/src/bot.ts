import type { IncomingMessage, ServerResponse } from "http";
import type { Request, Response } from "botbuilder";
import { TurnContext } from "botbuilder";

import { createLogger } from "@kan/logger";

import { getAdapter } from "./adapter";

const log = createLogger("teams");

export interface TeamsConnectInfo {
  /** The user's Entra directory object id (matches user.entraObjectId). */
  aadObjectId?: string;
  tenantId?: string;
  serviceUrl?: string;
  userName?: string;
  /** Serialized ConversationReference, for later proactive sends. */
  conversationReference: string;
}

export type OnConnect = (
  info: TeamsConnectInfo,
) => Promise<{ linked: boolean; displayName?: string }>;

/**
 * Handles an inbound Bot Framework request. On first contact (install or a
 * message) it captures the conversation reference + the user's Entra object id
 * and hands them to `onConnect` (which does the DB linking), then replies.
 */
export const processBotRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  onConnect: OnConnect,
): Promise<void> => {
  const adapter = getAdapter();

  // Bot Framework's Request/Response types are structurally close to Node's
  // http types but not assignable; the adapter reads/writes them as Node
  // streams at runtime, so the cast is safe.
  await adapter.process(req as unknown as Request, res as unknown as Response, async (context) => {
    const activity = context.activity;

    const isFirstContact =
      activity.type === "message" ||
      activity.type === "conversationUpdate" ||
      activity.type === "installationUpdate";

    if (!isFirstContact) return;

    const reference = TurnContext.getConversationReference(activity);

    const tenantId =
      activity.conversation?.tenantId ??
      (activity.channelData as { tenant?: { id?: string } } | undefined)?.tenant
        ?.id;

    const info: TeamsConnectInfo = {
      aadObjectId: activity.from?.aadObjectId,
      tenantId,
      serviceUrl: reference.serviceUrl,
      userName: activity.from?.name,
      conversationReference: JSON.stringify(reference),
    };

    let result: { linked: boolean; displayName?: string };
    try {
      result = await onConnect(info);
    } catch (error) {
      log.error({ err: error }, "Teams onConnect handler failed");
      result = { linked: false };
    }

    // Only reply to explicit messages (avoid noise on conversation/install
    // updates, which also fire when the bot is added).
    if (activity.type === "message") {
      await context.sendActivity(
        result.linked
          ? `✅ You're connected to Kan${
              result.displayName ? `, ${result.displayName}` : ""
            }. You'll receive your notifications here.`
          : "I couldn't match your Microsoft account to a Kan user. Please sign in to Kan with Microsoft first, then message me again.",
      );
    }
  });
};
