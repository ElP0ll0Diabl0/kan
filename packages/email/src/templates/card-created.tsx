import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const CardCreatedTemplate = ({
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
    previewText={`New card: ${cardTitle ?? "a card"}`}
    heading="A new card was created"
    ctaUrl={cardUrl}
    ctaLabel="View card"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      <strong>{actorName ?? "Someone"}</strong> created the card{" "}
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

export default CardCreatedTemplate;
