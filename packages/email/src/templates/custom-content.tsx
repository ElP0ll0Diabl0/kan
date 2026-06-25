import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Html } from "@react-email/html";
import { Link } from "@react-email/link";
import { Preview } from "@react-email/preview";
import { Text } from "@react-email/text";
import * as React from "react";

/**
 * Catch-all template used when the notification_rule for an event has a
 * customBody set. The body is admin-authored HTML (Tiptap output) and is
 * delivered as the *entire* email body with no Kan chrome — no brand
 * heading, no auto-injected H1, no "open source Trello alternative" footer.
 *
 * The admin is in full control of the message. The only thing this template
 * adds is:
 *  - a Preview line (used by email clients in the inbox preview)
 *  - a minimal unsubscribe footer when an unsubscribeUrl is supplied
 *    AND the admin's body does not already contain the URL (e.g. they
 *    inserted the {{unsubscribeUrl}} placeholder themselves)
 *
 * Placeholders ({{actorName}}, …) are already substituted at dispatch time,
 * so by the time we render here the html string is final.
 *
 * dangerouslySetInnerHTML is acceptable: the source is workspace-admin-
 * authored content saved through the Tiptap editor; the audience is opted-
 * in workspace members. The same surface that can edit this can already
 * invite users and grant board access.
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
  // If the admin already embedded the substituted unsubscribe URL anywhere in
  // their body, don't append our default footer — they explicitly placed it.
  const hasInlineUnsubscribe =
    !!unsubscribeUrl && bodyHtml.includes(unsubscribeUrl);
  const showAutoUnsubscribe = !!unsubscribeUrl && !hasInlineUnsubscribe;

  return (
    <Html>
      <Head />
      <Preview>{heading}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <div
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
          {showAutoUnsubscribe && (
            <Text style={unsubscribeStyle}>
              <Link href={unsubscribeUrl} style={unsubscribeLinkStyle}>
                Unsubscribe
              </Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
};

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: 0,
  padding: 0,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
  color: "#1a1a1a",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "32px 24px",
};

const unsubscribeStyle: React.CSSProperties = {
  marginTop: "32px",
  fontSize: "11px",
  color: "#888888",
  textAlign: "center",
};

const unsubscribeLinkStyle: React.CSSProperties = {
  color: "#888888",
  textDecoration: "underline",
};

export default CustomContentTemplate;
