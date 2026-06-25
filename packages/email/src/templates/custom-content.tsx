import * as React from "react";

import { NotificationLayout } from "./_layout";

/**
 * Catch-all template used when the notification_rule for an event has a
 * customBody set. The body is admin-authored HTML (Tiptap output) and is
 * rendered inline through the shared NotificationLayout chrome.
 *
 * Placeholders ({{actorName}}, {{cardTitle}}, …) are already substituted at
 * dispatch time, so by the time we render here the html string is final.
 *
 * Notes:
 *  - dangerouslySetInnerHTML is acceptable here because the source is
 *    workspace-admin-authored content saved through a Tiptap editor, and the
 *    email is delivered to opted-in workspace members. The same surface that
 *    can edit this can already invite users and grant board access.
 *  - heading is whatever the rule's customSubject (also substituted) resolves
 *    to, so the in-email H1 matches the email subject line.
 *  - unsubscribeUrl is appended automatically by the layout's footer when
 *    present in the dispatcher's data object.
 */
const CustomContentTemplate = ({
  heading,
  bodyHtml,
  unsubscribeUrl,
}: {
  heading: string;
  bodyHtml: string;
  unsubscribeUrl?: string;
}) => {
  return (
    <NotificationLayout
      previewText={heading}
      heading={heading}
      unsubscribeUrl={unsubscribeUrl}
    >
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </NotificationLayout>
  );
};

export default CustomContentTemplate;
