import type { ConversationReference } from "botbuilder";
import { CardFactory, MessageFactory } from "botbuilder";

import { getAdapter } from "./adapter";
import { getBotConfig } from "./config";

/**
 * Sends an Adaptive Card to a user proactively, using a previously-stored
 * (serialized) ConversationReference. Used by the notification dispatcher.
 */
export const sendProactiveCard = async (
  conversationReference: string,
  card: Record<string, unknown>,
): Promise<void> => {
  const adapter = getAdapter();
  const { appId } = getBotConfig();

  const reference = JSON.parse(conversationReference) as ConversationReference;

  await adapter.continueConversationAsync(appId, reference, async (context) => {
    await context.sendActivity(
      MessageFactory.attachment(CardFactory.adaptiveCard(card)),
    );
  });
};
