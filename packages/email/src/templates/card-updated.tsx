import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const CardUpdatedTemplate = ({
  actorName,
  cardTitle,
  boardName,
  cardUrl,
  changeSummary,
  unsubscribeUrl,
}: {
  actorName?: string;
  cardTitle?: string;
  boardName?: string;
  cardUrl?: string;
  changeSummary?: string;
  unsubscribeUrl?: string;
}) => (
  <NotificationLayout
    previewText={`${cardTitle ?? "A card"} was updated`}
    heading="A card was updated"
    ctaUrl={cardUrl}
    ctaLabel="View card"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      <strong>{actorName ?? "Someone"}</strong> updated the card{" "}
      <strong>{cardTitle ?? "a card"}</strong>
      {boardName ? (
        <>
          {" "}
          in the board <strong>{boardName}</strong>
        </>
      ) : null}
      .
    </Text>
    {changeSummary ? (
      <Text style={bodyTextStyle}>{changeSummary}</Text>
    ) : null}
  </NotificationLayout>
);

export default CardUpdatedTemplate;
