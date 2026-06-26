import type { ConversationReference } from "botbuilder";
import { CardFactory, MessageFactory } from "botbuilder";

import { getAdapter } from "./adapter";
import type { BotConfig } from "./config";

/**
 * Sends an Adaptive Card to a user proactively, using a previously-stored
 * (serialized) ConversationReference. Used by the notification dispatcher.
 */
export const sendProactiveCard = async (
  conversationReference: string,
  card: Record<string, unknown>,
  config: BotConfig,
): Promise<void> => {
  const adapter = getAdapter(config);

  const reference = JSON.parse(conversationReference) as ConversationReference;

  await adapter.continueConversationAsync(
    config.appId,
    reference,
    async (context) => {
      await context.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(card)),
      );
    },
  );
};
