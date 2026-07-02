import type { NotificationEventType } from "@kan/db/schema";

/**
 * Per-event placeholder catalog. Each entry's `key` MUST match a property
 * present on the corresponding event's `data` object returned by
 * resolveContext() in notifications.ts. If they drift, the editor will offer
 * tokens that never substitute, and admins will see literal {{...}} in their
 * emails.
 *
 * The shared registry is consumed in two places:
 *   - Server-side, by substituteTokens() in notifications.ts.
 *   - Client-side, by the NotificationEditor placeholder dropdown.
 *
 * `label` is the human-friendly text shown in the dropdown. `key` is what
 * gets inserted (and matched).
 *
 * To extend: when you add a new event type to NotificationEventType, add an
 * entry here AND ensure resolveContext() emits the matching `data` keys.
 */
export interface NotificationPlaceholder {
  key: string;
  label: string;
}

/**
 * Available on every event — substituted to a per-recipient JWT unsubscribe
 * link inside the dispatcher loop. Admins can drop `{{unsubscribeUrl}}` into
 * a custom body to position the link wherever they want; if they don't, the
 * CUSTOM_CONTENT template appends a minimal Unsubscribe footer automatically.
 */
const UNSUBSCRIBE_PLACEHOLDER: NotificationPlaceholder = {
  key: "unsubscribeUrl",
  label: "Unsubscribe URL",
};

const PER_EVENT_PLACEHOLDERS: Record<
  NotificationEventType,
  readonly NotificationPlaceholder[]
> = {
  "card.created": [
    { key: "actorName", label: "Actor name" },
    { key: "cardTitle", label: "Card title" },
    { key: "boardName", label: "Board name" },
    { key: "cardUrl", label: "Card URL" },
  ],
  "card.updated": [
    { key: "actorName", label: "Actor name" },
    { key: "cardTitle", label: "Card title" },
    { key: "boardName", label: "Board name" },
    { key: "cardUrl", label: "Card URL" },
    { key: "changeSummary", label: "Change summary" },
  ],
  "card.moved": [
    { key: "actorName", label: "Actor name" },
    { key: "cardTitle", label: "Card title" },
    { key: "boardName", label: "Board name" },
    { key: "cardUrl", label: "Card URL" },
    { key: "changeSummary", label: "Change summary" },
  ],
  "card.deleted": [
    { key: "actorName", label: "Actor name" },
    { key: "cardTitle", label: "Card title" },
    { key: "boardName", label: "Board name" },
  ],
  "card.comment.added": [
    { key: "actorName", label: "Actor name" },
    { key: "cardTitle", label: "Card title" },
    { key: "boardName", label: "Board name" },
    { key: "cardUrl", label: "Card URL" },
    { key: "commentExcerpt", label: "Comment excerpt" },
  ],
  "card.member.added": [
    { key: "actorName", label: "Actor name" },
    { key: "cardTitle", label: "Card title" },
    { key: "boardName", label: "Board name" },
    { key: "cardUrl", label: "Card URL" },
  ],
  "card.member.removed": [
    { key: "actorName", label: "Actor name" },
    { key: "cardTitle", label: "Card title" },
    { key: "boardName", label: "Board name" },
    { key: "cardUrl", label: "Card URL" },
  ],
  "card.checklist.item.assigned": [
    { key: "actorName", label: "Actor name" },
    { key: "taskTitle", label: "Task title" },
    { key: "cardTitle", label: "Card title" },
    { key: "boardName", label: "Board name" },
    { key: "cardUrl", label: "Card URL" },
  ],
  mention: [
    { key: "commenterName", label: "Commenter name" },
    { key: "boardName", label: "Board name" },
    { key: "cardTitle", label: "Card title" },
    { key: "cardUrl", label: "Card URL" },
  ],
  "workspace.member.added": [
    { key: "workspaceName", label: "Workspace name" },
    { key: "inviterName", label: "Inviter name" },
    { key: "boards", label: "Board list" },
    { key: "ctaUrl", label: "Call-to-action URL" },
    { key: "ctaLabel", label: "Call-to-action label" },
  ],
  "workspace.member.removed": [
    { key: "workspaceName", label: "Workspace name" },
    { key: "actorName", label: "Actor name" },
  ],
  "workspace.role.changed": [
    { key: "workspaceName", label: "Workspace name" },
    { key: "newRole", label: "New role" },
    { key: "actorName", label: "Actor name" },
  ],
  "board.access.granted": [
    { key: "boardName", label: "Board name" },
    { key: "boardUrl", label: "Board URL" },
    { key: "actorName", label: "Actor name" },
  ],
};

/**
 * Public registry: event-specific tokens plus the universal {{unsubscribeUrl}}.
 * Built once at module load; both the dispatcher (substitution) and the
 * editor UI (dropdown) consume this same shape.
 */
export const EVENT_PLACEHOLDERS: Record<
  NotificationEventType,
  readonly NotificationPlaceholder[]
> = Object.fromEntries(
  Object.entries(PER_EVENT_PLACEHOLDERS).map(([event, placeholders]) => [
    event,
    [...placeholders, UNSUBSCRIBE_PLACEHOLDER],
  ]),
) as unknown as Record<NotificationEventType, readonly NotificationPlaceholder[]>;

const TOKEN_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Substitutes {{token}} occurrences in `input` with values from `data`.
 * Unknown tokens are replaced with an empty string so admins never see raw
 * curly braces in delivered emails. Falsy/undefined values also collapse to
 * empty string for the same reason.
 *
 * This is intentionally simple — no expressions, no filters, no escaping.
 * The Tiptap-emitted HTML is already trusted (workspace-admin-authored).
 */
export const substituteTokens = (
  input: string,
  data: Record<string, unknown>,
): string => {
  if (!input) return input;
  return input.replace(TOKEN_RE, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
};
