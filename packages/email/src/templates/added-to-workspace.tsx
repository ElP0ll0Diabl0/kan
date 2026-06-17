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

export const AddedToWorkspaceTemplate = ({
  workspaceName,
  inviterName,
  boards,
  ctaUrl,
  ctaLabel,
}: {
  workspaceName?: string;
  inviterName?: string;
  boards?: string;
  ctaUrl?: string;
  ctaLabel?: string;
}) => (
  <Html>
    <Head />
    <Preview>You've been added to {workspaceName ?? "a workspace"}</Preview>
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
          {env("NEXT_PUBLIC_WHITE_LABEL_HIDE_POWERED_BY") !== "true" && "Kan"}
        </Heading>
        <Heading
          style={{ fontSize: "24px", fontWeight: "bold", color: "#232323" }}
        >
          {inviterName
            ? `${inviterName} added you to ${workspaceName ?? "a workspace"}`
            : `You've been added to ${workspaceName ?? "a workspace"}`}
        </Heading>
        <Text
          style={{
            fontSize: "0.875rem",
            marginBottom: boards ? "0.5rem" : "2rem",
            color: "#232323",
          }}
        >
          You now have access to{" "}
          <strong>{workspaceName ?? "the workspace"}</strong>.
        </Text>
        {boards && (
          <Text
            style={{
              fontSize: "0.875rem",
              marginBottom: "2rem",
              color: "#232323",
            }}
          >
            You were also given access to the following boards:{" "}
            <strong>{boards}</strong>.
          </Text>
        )}
        {ctaUrl && (
          <Button
            target="_blank"
            href={ctaUrl}
            style={{
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
      </Container>
    </Body>
  </Html>
);

export default AddedToWorkspaceTemplate;
