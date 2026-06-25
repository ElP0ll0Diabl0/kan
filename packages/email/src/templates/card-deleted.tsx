import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const CardDeletedTemplate = ({
  actorName,
  cardTitle,
  boardName,
  unsubscribeUrl,
}: {
  actorName?: string;
  cardTitle?: string;
  boardName?: string;
  unsubscribeUrl?: string;
}) => (
  <NotificationLayout
    previewText={`${cardTitle ?? "A card"} was deleted`}
    heading="A card was deleted"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      <strong>{actorName ?? "Someone"}</strong> deleted the card{" "}
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

export default CardDeletedTemplate;
