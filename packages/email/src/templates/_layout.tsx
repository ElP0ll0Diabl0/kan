import { Body } from "@react-email/body";
import { Button } from "@react-email/button";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Link } from "@react-email/link";
import { Preview } from "@react-email/preview";
import { Text } from "@react-email/text";
import { env } from "next-runtime-env";
import * as React from "react";

/**
 * Shared chrome for the notification emails: brand heading (respecting
 * white-label), the event-specific heading + body, an optional CTA button, and
 * a footer with an optional unsubscribe link. Keeps all notification templates
 * visually consistent with `mention.tsx` / `added-to-workspace.tsx`.
 */
export const NotificationLayout = ({
  previewText,
  heading,
  ctaUrl,
  ctaLabel,
  unsubscribeUrl,
  children,
}: {
  previewText: string;
  heading: string;
  ctaUrl?: string;
  ctaLabel?: string;
  unsubscribeUrl?: string;
  children: React.ReactNode;
}) => {
  const hidePoweredBy =
    env("NEXT_PUBLIC_WHITE_LABEL_HIDE_POWERED_BY") === "true";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "white" }}>
        <Container
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
            margin: "auto",
            paddingLeft: "0.75rem",
            paddingRight: "0.75rem",
          }}
        >
          <Heading
            style={{
              marginTop: "2.5rem",
              marginBottom: "2.5rem",
              fontSize: "24px",
              fontWeight: "bold",
              color: "#232323",
            }}
          >
            {hidePoweredBy ? "" : "kan.bn"}
          </Heading>
          <Heading
            style={{ fontSize: "24px", fontWeight: "bold", color: "#232323" }}
          >
            {heading}
          </Heading>
          {children}
          {ctaUrl && (
            <Button
              target="_blank"
              href={ctaUrl}
              style={{
                marginTop: "0.5rem",
                marginBottom: "2rem",
                borderRadius: "0.375rem",
                backgroundColor: "#282828",
                paddingLeft: "1.5rem",
                paddingRight: "1.5rem",
                paddingTop: "1rem",
                paddingBottom: "1rem",
                fontSize: "0.875rem",
                fontWeight: "500",
                lineHeight: "1",
                color: "white",
              }}
            >
              {ctaLabel ?? "Open"}
            </Button>
          )}
          <Hr
            style={{
              marginTop: "2.5rem",
              marginBottom: "2rem",
              borderWidth: "1px",
            }}
          />
          {!hidePoweredBy && (
            <Text style={{ color: "#7e7e7e" }}>
              <Link
                href={env("NEXT_PUBLIC_BASE_URL")}
                target="_blank"
                style={{ color: "#7e7e7e", textDecoration: "underline" }}
              >
                Kan
              </Link>
              , the open source Trello alternative.
            </Text>
          )}
          {unsubscribeUrl && (
            <Text style={{ color: "#7e7e7e", fontSize: "0.75rem" }}>
              Don't want these emails?{" "}
              <Link
                href={unsubscribeUrl}
                target="_blank"
                style={{ color: "#7e7e7e", textDecoration: "underline" }}
              >
                Unsubscribe
              </Link>
              .
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
};

/** Shared body-paragraph style for notification templates. */
export const bodyTextStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  marginBottom: "1rem",
  color: "#232323",
};

export default NotificationLayout;
