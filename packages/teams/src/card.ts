export interface NotificationCardInput {
  heading: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

/**
 * Builds a minimal Adaptive Card for a notification. Kept channel-agnostic —
 * the dispatcher maps a notification event to this shape, mirroring how the
 * email templates consume the same `data`.
 */
export const buildNotificationCard = (
  input: NotificationCardInput,
): Record<string, unknown> => ({
  type: "AdaptiveCard",
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.4",
  body: [
    {
      type: "TextBlock",
      text: input.heading,
      weight: "Bolder",
      size: "Medium",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: input.body,
      wrap: true,
      spacing: "Small",
    },
  ],
  actions:
    input.ctaUrl && input.ctaUrl.length > 0
      ? [
          {
            type: "Action.OpenUrl",
            title: input.ctaLabel ?? "Open",
            url: input.ctaUrl,
          },
        ]
      : [],
});
