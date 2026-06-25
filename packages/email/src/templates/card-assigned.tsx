import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const CardAssignedTemplate = ({
  actorName,
  cardTitle,
  boardName,
  cardUrl,
  unsubscribeUrl,
}: {
  actorName?: string;
  cardTitle?: string;
  boardName?: string;
  cardUrl?: string;
  unsubscribeUrl?: string;
}) => (
  <NotificationLayout
    previewText={`You were assigned to ${cardTitle ?? "a card"}`}
    heading="You were assigned to a card"
    ctaUrl={cardUrl}
    ctaLabel="View card"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      <strong>{actorName ?? "Someone"}</strong> assigned you to the card{" "}
      <strong>{cardTitle ?? "a card"}</strong>
      {boardName ? (
        <>
          {" "}
          in the board <strong>{boardName}</strong>
        </>
      ) : null}
      .
    </Text>
  </NotificationLayout>
);

export default CardAssignedTemplate;
