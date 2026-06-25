import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const BoardAccessTemplate = ({
  actorName,
  boardName,
  boardUrl,
  unsubscribeUrl,
}: {
  actorName?: string;
  boardName?: string;
  boardUrl?: string;
  unsubscribeUrl?: string;
}) => (
  <NotificationLayout
    previewText={`You were granted access to ${boardName ?? "a board"}`}
    heading="You were granted access to a board"
    ctaUrl={boardUrl}
    ctaLabel="Open board"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      <strong>{actorName ?? "Someone"}</strong> gave you access to the board{" "}
      <strong>{boardName ?? "a board"}</strong>.
    </Text>
  </NotificationLayout>
);

export default BoardAccessTemplate;
