import { Text } from "@react-email/text";
import * as React from "react";

import { bodyTextStyle, NotificationLayout } from "./_layout";

export const WorkspaceRoleChangedTemplate = ({
  workspaceName,
  newRole,
  actorName,
  unsubscribeUrl,
}: {
  workspaceName?: string;
  newRole?: string;
  actorName?: string;
  unsubscribeUrl?: string;
}) => (
  <NotificationLayout
    previewText={`Your role in ${workspaceName ?? "a workspace"} changed`}
    heading="Your workspace role changed"
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text style={bodyTextStyle}>
      {actorName ? (
        <>
          <strong>{actorName}</strong> changed your role in{" "}
        </>
      ) : (
        "Your role changed in "
      )}
      <strong>{workspaceName ?? "a workspace"}</strong>
      {newRole ? (
        <>
          {" "}
          to <strong>{newRole}</strong>
        </>
      ) : null}
      .
    </Text>
  </NotificationLayout>
);

export default WorkspaceRoleChangedTemplate;
