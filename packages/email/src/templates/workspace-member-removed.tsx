import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const WorkspaceMemberRemovedTemplate = ({
  actorName,
  workspaceName,
  unsubscribeUrl,
}: {
  actorName?: string;
  workspaceName?: string;
  unsubscribeUrl?: string;
}) => (
  <NotificationLayout
    previewText={`You were removed from ${workspaceName ?? "a workspace"}`}
    heading="You were removed from a workspace"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      {actorName ? (
        <>
          <strong>{actorName}</strong> removed you from the workspace{" "}
        </>
      ) : (
        "You were removed from the workspace "
      )}
      <strong>{workspaceName ?? "a workspace"}</strong>.
    </Text>
  </NotificationLayout>
);

export default WorkspaceMemberRemovedTemplate;
