import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const CardUnassignedTemplate = ({
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
    previewText={`You were removed from ${cardTitle ?? "a card"}`}
    heading="You were removed from a card"
    ctaUrl={cardUrl}
    ctaLabel="View card"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      <strong>{actorName ?? "Someone"}</strong> removed you from the card{" "}
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

export default CardUnassignedTemplate;
