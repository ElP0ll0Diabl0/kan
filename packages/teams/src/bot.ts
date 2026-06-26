import type { IncomingMessage, ServerResponse } from "http";
import type { Request, Response } from "botbuilder";
import { TurnContext } from "botbuilder";

import { createLogger } from "@kan/logger";

import { getAdapter } from "./adapter";
import type { BotConfig } from "./config";

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
  config: BotConfig,
): Promise<void> => {
  const adapter = getAdapter(config);

  // botbuilder 4.23's CloudAdapter.process() validates the response object with
  // a Zod schema that requires an Express-style `.header()` method; Node's
  // ServerResponse (and Next's NextApiResponse) only expose `setHeader()`, so
  // the parse throws and the request 500s before auth even runs. The method is
  // never actually called when writing the reply (the adapter uses
  // status/send/end), so a thin alias is enough to satisfy the check. The
  // adapter also reads `req.body` as an already-parsed object, so the API route
  // must leave Next's body parsing enabled (see api/teams/messages.ts).
  const compatRes = res as ServerResponse & {
    header?: (name: string, value: string) => unknown;
  };
  if (typeof compatRes.header !== "function") {
    compatRes.header = (name, value) => res.setHeader(name, value);
  }

  // The Bot Framework Request/Response types are structurally close to Node's
  // http types but not assignable, so cast at the call boundary.
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
