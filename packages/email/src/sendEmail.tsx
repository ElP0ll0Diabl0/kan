import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { createLogger } from "@kan/logger";

const log = createLogger("email");

import AddedToWorkspaceTemplate from "./templates/added-to-workspace";
import BoardAccessTemplate from "./templates/board-access";
import CardAssignedTemplate from "./templates/card-assigned";
import CardCommentTemplate from "./templates/card-comment";
import CardCreatedTemplate from "./templates/card-created";
import CardDeletedTemplate from "./templates/card-deleted";
import CardUnassignedTemplate from "./templates/card-unassigned";
import CardUpdatedTemplate from "./templates/card-updated";
import CustomContentTemplate from "./templates/custom-content";
import JoinWorkspaceTemplate from "./templates/join-workspace";
import MagicLinkTemplate from "./templates/magic-link";
import MentionTemplate from "./templates/mention";
import ResetPasswordTemplate from "./templates/reset-password";
import WorkspaceMemberRemovedTemplate from "./templates/workspace-member-removed";
import WorkspaceRoleChangedTemplate from "./templates/workspace-role-changed";

export type Templates =
  | "MAGIC_LINK"
  | "JOIN_WORKSPACE"
  | "RESET_PASSWORD"
  | "MENTION"
  | "ADDED_TO_WORKSPACE"
  | "CARD_CREATED"
  | "CARD_UPDATED"
  | "CARD_COMMENT"
  | "CARD_ASSIGNED"
  | "CARD_UNASSIGNED"
  | "CARD_DELETED"
  | "BOARD_ACCESS"
  | "WORKSPACE_MEMBER_REMOVED"
  | "WORKSPACE_ROLE_CHANGED"
  | "CUSTOM_CONTENT";

const emailTemplates: Record<Templates, React.ComponentType<any>> = {
  MAGIC_LINK: MagicLinkTemplate,
  JOIN_WORKSPACE: JoinWorkspaceTemplate,
  RESET_PASSWORD: ResetPasswordTemplate,
  MENTION: MentionTemplate,
  ADDED_TO_WORKSPACE: AddedToWorkspaceTemplate,
  CARD_CREATED: CardCreatedTemplate,
  CARD_UPDATED: CardUpdatedTemplate,
  CARD_COMMENT: CardCommentTemplate,
  CARD_ASSIGNED: CardAssignedTemplate,
  CARD_UNASSIGNED: CardUnassignedTemplate,
  CARD_DELETED: CardDeletedTemplate,
  BOARD_ACCESS: BoardAccessTemplate,
  WORKSPACE_MEMBER_REMOVED: WorkspaceMemberRemovedTemplate,
  WORKSPACE_ROLE_CHANGED: WorkspaceRoleChangedTemplate,
  CUSTOM_CONTENT: CustomContentTemplate,
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure:
    process.env.SMTP_SECURE === undefined
      ? true
      : process.env.SMTP_SECURE?.toLowerCase() === "true",
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized:
      process.env.SMTP_REJECT_UNAUTHORIZED === undefined
        ? true
        : process.env.SMTP_REJECT_UNAUTHORIZED?.toLowerCase() === "true",
  },
  ...(process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD && {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    }),
});

export const sendEmail = async (
  to: string,
  subject: string,
  template: Templates,
  data: Record<string, string>,
) => {
  log.info({ to, subject, template }, "Sending email");
  try {
    const EmailTemplate = emailTemplates[template];

    const html = await render(<EmailTemplate {...data} />, { pretty: true });

    const options = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    };

    const response = await transporter.sendMail(options);

    if (!response.accepted.length) {
      throw new Error(`Failed to send email: ${response.response}`);
    }

    log.info({ to, subject, template, messageId: response.messageId }, "Email sent");
    return response;
  } catch (error) {
    log.error({ err: error, to, from: process.env.EMAIL_FROM, subject, template }, "Email sending failed");
    throw error;
  }
};
