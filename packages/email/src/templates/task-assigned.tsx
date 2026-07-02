import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const TaskAssignedTemplate = ({
  actorName,
  taskTitle,
  cardTitle,
  boardName,
  cardUrl,
  unsubscribeUrl,
}: {
  actorName?: string;
  taskTitle?: string;
  cardTitle?: string;
  boardName?: string;
  cardUrl?: string;
  unsubscribeUrl?: string;
}) => (
  <NotificationLayout
    previewText={`You were assigned a task on ${cardTitle ?? "a card"}`}
    heading="You were assigned a task"
    ctaUrl={cardUrl}
    ctaLabel="View card"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      <strong>{actorName ?? "Someone"}</strong> assigned you the task{" "}
      <strong>{taskTitle ?? "a task"}</strong>
      {cardTitle ? (
        <>
          {" "}
          on the card <strong>{cardTitle}</strong>
        </>
      ) : null}
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

export default TaskAssignedTemplate;
