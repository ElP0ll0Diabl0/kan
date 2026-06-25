import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export type NotificationEventType =
  | "card.created"
  | "card.updated"
  | "card.moved"
  | "card.deleted"
  | "card.comment.added"
  | "card.member.added"
  | "card.member.removed"
  | "mention"
  | "workspace.member.added"
  | "workspace.member.removed"
  | "workspace.role.changed"
  | "board.access.granted";

export interface NotificationEventMeta {
  eventType: NotificationEventType;
  group: "card" | "workspace";
  label: MessageDescriptor;
  description: MessageDescriptor;
}

/**
 * Display metadata for every manageable notification event. Order here is the
 * order rendered in the admin UI. Labels/descriptions use `msg` so they can be
 * lazily translated with the `i18n` macro at render time.
 */
export const NOTIFICATION_EVENTS: NotificationEventMeta[] = [
  {
    eventType: "card.member.added",
    group: "card",
    label: msg`Assigned to a card`,
    description: msg`Emails a member when they're assigned to a card.`,
  },
  {
    eventType: "card.member.removed",
    group: "card",
    label: msg`Removed from a card`,
    description: msg`Emails a member when they're removed from a card.`,
  },
  {
    eventType: "card.comment.added",
    group: "card",
    label: msg`New comment`,
    description: msg`Emails a card's assigned members when a comment is added.`,
  },
  {
    eventType: "mention",
    group: "card",
    label: msg`Mention`,
    description: msg`Emails a member when they're @mentioned in a comment or description.`,
  },
  {
    eventType: "card.created",
    group: "card",
    label: msg`Card created`,
    description: msg`Emails assigned members when a card is created.`,
  },
  {
    eventType: "card.updated",
    group: "card",
    label: msg`Card updated`,
    description: msg`Emails assigned members when a card's title, description or due date changes.`,
  },
  {
    eventType: "card.moved",
    group: "card",
    label: msg`Card moved`,
    description: msg`Emails assigned members when a card is moved to another list.`,
  },
  {
    eventType: "card.deleted",
    group: "card",
    label: msg`Card deleted`,
    description: msg`Emails assigned members when a card is deleted.`,
  },
  {
    eventType: "workspace.member.added",
    group: "workspace",
    label: msg`Added to workspace`,
    description: msg`Emails a user when they're added to a workspace.`,
  },
  {
    eventType: "workspace.member.removed",
    group: "workspace",
    label: msg`Removed from workspace`,
    description: msg`Emails a user when they're removed from a workspace.`,
  },
  {
    eventType: "workspace.role.changed",
    group: "workspace",
    label: msg`Workspace role changed`,
    description: msg`Emails a user when their workspace role changes.`,
  },
  {
    eventType: "board.access.granted",
    group: "workspace",
    label: msg`Board access granted`,
    description: msg`Emails a user when they're granted access to a restricted board.`,
  },
];

export const NOTIFICATION_EVENT_GROUPS: {
  key: "card" | "workspace";
  label: MessageDescriptor;
}[] = [
  { key: "card", label: msg`Card events` },
  { key: "workspace", label: msg`Workspace & membership events` },
];
