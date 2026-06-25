import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const CardCommentTemplate = ({
  actorName,
  cardTitle,
  boardName,
  cardUrl,
  commentExcerpt,
  unsubscribeUrl,
}: {
  actorName?: string;
  cardTitle?: string;
  boardName?: string;
  cardUrl?: string;
  commentExcerpt?: string;
  unsubscribeUrl?: string;
}) => (
  <NotificationLayout
    previewText={`${actorName ?? "Someone"} commented on ${cardTitle ?? "a card"}`}
    heading="New comment on a card"
    ctaUrl={cardUrl}
    ctaLabel="View comment"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      <strong>{actorName ?? "Someone"}</strong> commented on the card{" "}
      <strong>{cardTitle ?? "a card"}</strong>
      {boardName ? (
        <>
          {" "}
          in the board <strong>{boardName}</strong>
        </>
      ) : null}
      .
    </Text>
    {commentExcerpt ? (
      <Text
        style={{
          ...bodyTextStyle,
          borderLeft: "3px solid #e5e5e5",
          paddingLeft: "0.75rem",
          color: "#555555",
        }}
      >
        {commentExcerpt}
      </Text>
    ) : null}
  </NotificationLayout>
);

export default CardCommentTemplate;
