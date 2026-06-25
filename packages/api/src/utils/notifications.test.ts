import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@kan/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

vi.mock("next-runtime-env", () => ({
  env: vi.fn(() => "https://app.test"),
}));

vi.mock("@kan/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@kan/shared/utils", () => ({
  parseMentionsFromHTML: vi.fn(),
  createEmailUnsubscribeLink: vi.fn(async () => "https://app.test/unsubscribe?token=x"),
}));

vi.mock("@kan/db/repository/card.repo", () => ({
  getWithListAndMembersByPublicId: vi.fn(),
}));
vi.mock("@kan/db/repository/member.repo", () => ({
  getByPublicIdsWithUsers: vi.fn(),
  getById: vi.fn(),
}));
vi.mock("@kan/db/repository/notification.repo", () => ({
  exists: vi.fn(async () => false),
  create: vi.fn(),
}));
vi.mock("@kan/db/repository/notificationRule.repo", () => ({
  getResolvedRules: vi.fn(async () => new Map()),
}));
vi.mock("@kan/db/repository/user.repo", () => ({
  getById: vi.fn(),
  isEmailUnsubscribed: vi.fn(async () => false),
}));
vi.mock("@kan/db/repository/workspace.repo", () => ({
  getByPublicId: vi.fn(async () => ({ id: 10 })),
}));
vi.mock("@kan/db/repository/teamsConversation.repo", () => ({
  getByUserId: vi.fn(async () => null),
}));
vi.mock("@kan/teams", () => ({
  isTeamsEnabled: vi.fn(() => false),
  sendProactiveCard: vi.fn(),
  buildNotificationCard: vi.fn((input: unknown) => input),
}));

import * as cardRepo from "@kan/db/repository/card.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as notificationRepo from "@kan/db/repository/notification.repo";
import * as notificationRuleRepo from "@kan/db/repository/notificationRule.repo";
import * as teamsConversationRepo from "@kan/db/repository/teamsConversation.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import { sendEmail } from "@kan/email";
import { parseMentionsFromHTML } from "@kan/shared/utils";
import { isTeamsEnabled, sendProactiveCard } from "@kan/teams";

import type { dbClient } from "@kan/db/client";
import {
  dispatchNotification,
  EVENT_DEFAULT_ENABLED,
  resolveRule,
} from "./notifications";

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;
const mockParseMentions = parseMentionsFromHTML as ReturnType<typeof vi.fn>;
const mockGetCard = cardRepo.getWithListAndMembersByPublicId as ReturnType<typeof vi.fn>;
const mockGetMentioned = memberRepo.getByPublicIdsWithUsers as ReturnType<typeof vi.fn>;
const mockMemberGetById = memberRepo.getById as ReturnType<typeof vi.fn>;
const mockExists = notificationRepo.exists as ReturnType<typeof vi.fn>;
const mockGetResolvedRules = notificationRuleRepo.getResolvedRules as ReturnType<typeof vi.fn>;
const mockUserGetById = userRepo.getById as ReturnType<typeof vi.fn>;
const mockIsUnsubscribed = userRepo.isEmailUnsubscribed as ReturnType<typeof vi.fn>;
const mockIsTeamsEnabled = isTeamsEnabled as ReturnType<typeof vi.fn>;
const mockSendProactiveCard = sendProactiveCard as ReturnType<typeof vi.fn>;
const mockGetConversation = teamsConversationRepo.getByUserId as ReturnType<typeof vi.fn>;

const db = {} as dbClient;
const ACTOR = "actor-user";

const cardWithMembers = (members: unknown[]) => ({
  id: 1,
  publicId: "card-public-1",
  title: "My Card",
  members,
  list: {
    board: { name: "My Board", workspace: { publicId: "ws-public" } },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockExists.mockResolvedValue(false);
  mockIsUnsubscribed.mockResolvedValue(false);
  mockGetResolvedRules.mockResolvedValue(new Map());
  mockIsTeamsEnabled.mockReturnValue(false);
  mockGetConversation.mockResolvedValue(null);
  mockUserGetById.mockImplementation(async (_db: unknown, id: string) =>
    id === ACTOR ? { id: ACTOR, name: "Actor", email: "actor@test.com" } : null,
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveRule", () => {
  it("falls back to the compiled default when no rule row exists", async () => {
    mockGetResolvedRules.mockResolvedValue(new Map());

    const mention = await resolveRule(db, 10, "mention");
    expect(mention.emailEnabled).toBe(EVENT_DEFAULT_ENABLED.mention); // true
    expect(mention.emailEnabled).toBe(true);
    expect(mention.teamsEnabled).toBe(false); // Teams is opt-in by default
    expect(mention.customSubject).toBeNull();

    const cardCreated = await resolveRule(db, 10, "card.created");
    expect(cardCreated.emailEnabled).toBe(false);
  });

  it("uses the resolved rule's channel flags and custom subject", async () => {
    mockGetResolvedRules.mockResolvedValue(
      new Map([
        [
          "mention",
          {
            enabled: false,
            teamsEnabled: true,
            customSubject: "Custom",
            customBody: null,
            source: "workspace",
          },
        ],
      ]),
    );

    const rule = await resolveRule(db, 10, "mention");
    expect(rule.emailEnabled).toBe(false);
    expect(rule.teamsEnabled).toBe(true);
    expect(rule.customSubject).toBe("Custom");
  });
});

describe("getResolvedRules collapse (workspace overrides global)", () => {
  it("prefers the workspace row over the global row regardless of order", async () => {
    const actual = await vi.importActual<
      typeof import("@kan/db/repository/notificationRule.repo")
    >("@kan/db/repository/notificationRule.repo");

    const rows = [
      {
        eventType: "mention",
        enabled: false,
        customSubject: null,
        customBody: null,
        workspaceId: null,
      },
      {
        eventType: "mention",
        enabled: true,
        customSubject: "WS",
        customBody: null,
        workspaceId: 10,
      },
    ];

    for (const ordered of [rows, [...rows].reverse()]) {
      const fakeDb = {
        query: {
          notificationRules: { findMany: vi.fn(async () => ordered) },
        },
      } as unknown as dbClient;

      const resolved = await actual.getResolvedRules(fakeDb, 10);
      expect(resolved.get("mention")).toEqual({
        enabled: true,
        customSubject: "WS",
        customBody: null,
        source: "workspace",
      });
    }
  });
});

describe("dispatchNotification — mention", () => {
  const setupMention = (
    members: { id: string; email: string; name?: string }[],
  ) => {
    mockParseMentions.mockReturnValue(["m-public-1"]);
    mockGetCard.mockResolvedValue(cardWithMembers([]));
    mockGetMentioned.mockResolvedValue(
      members.map((m) => ({
        email: m.email,
        user: { id: m.id, name: m.name ?? m.email, email: m.email },
      })),
    );
  };

  it("sends a mention email to the mentioned member", async () => {
    setupMention([{ id: "user-1", email: "m1@test.com" }]);

    await dispatchNotification(db, {
      event: "mention",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
      commentHtml: "<p>hi</p>",
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [to, , template, data] = mockSendEmail.mock.calls[0]!;
    expect(to).toBe("m1@test.com");
    expect(template).toBe("MENTION");
    expect(data.unsubscribeUrl).toContain("/unsubscribe");
  });

  it("does not send when the rule is disabled", async () => {
    setupMention([{ id: "user-1", email: "m1@test.com" }]);
    mockGetResolvedRules.mockResolvedValue(
      new Map([
        [
          "mention",
          { enabled: false, customSubject: null, customBody: null, source: "global" },
        ],
      ]),
    );

    await dispatchNotification(db, {
      event: "mention",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
      commentHtml: "<p>hi</p>",
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("filters out the actor from recipients", async () => {
    setupMention([{ id: ACTOR, email: "actor@test.com" }]);

    await dispatchNotification(db, {
      event: "mention",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
      commentHtml: "<p>hi</p>",
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips unsubscribed recipients", async () => {
    setupMention([{ id: "user-1", email: "m1@test.com" }]);
    mockIsUnsubscribed.mockResolvedValue(true);

    await dispatchNotification(db, {
      event: "mention",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
      commentHtml: "<p>hi</p>",
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips recipients with an existing notification (dedupe)", async () => {
    setupMention([{ id: "user-1", email: "m1@test.com" }]);
    mockExists.mockResolvedValue(true);

    await dispatchNotification(db, {
      event: "mention",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
      commentHtml: "<p>hi</p>",
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("isolates per-recipient errors — one failure does not block the rest", async () => {
    setupMention([
      { id: "user-1", email: "m1@test.com" },
      { id: "user-2", email: "m2@test.com" },
    ]);
    mockSendEmail.mockRejectedValueOnce(new Error("smtp down"));

    await dispatchNotification(db, {
      event: "mention",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
      commentHtml: "<p>hi</p>",
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("dispatchNotification — card events", () => {
  it("does not send card.created by default (opt-in event)", async () => {
    mockGetCard.mockResolvedValue(
      cardWithMembers([
        { email: "m1@test.com", user: { id: "user-1", name: "M1" } },
      ]),
    );
    mockGetResolvedRules.mockResolvedValue(new Map()); // no rule → default OFF

    await dispatchNotification(db, {
      event: "card.created",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends card.comment.added to assigned members when enabled", async () => {
    mockGetCard.mockResolvedValue(
      cardWithMembers([
        { email: "m1@test.com", user: { id: "user-1", name: "M1" } },
        { email: "actor@test.com", user: { id: ACTOR, name: "Actor" } },
      ]),
    );
    mockGetResolvedRules.mockResolvedValue(
      new Map([
        [
          "card.comment.added",
          { enabled: true, customSubject: null, customBody: null, source: "global" },
        ],
      ]),
    );

    await dispatchNotification(db, {
      event: "card.comment.added",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
      commentId: 5,
      commentExcerpt: "nice work",
    });

    // Only the non-actor assigned member is emailed.
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [to, , template] = mockSendEmail.mock.calls[0]!;
    expect(to).toBe("m1@test.com");
    expect(template).toBe("CARD_COMMENT");
  });

  it("applies a custom subject override", async () => {
    mockGetCard.mockResolvedValue(
      cardWithMembers([
        { email: "m1@test.com", user: { id: "user-1", name: "M1" } },
      ]),
    );
    mockGetResolvedRules.mockResolvedValue(
      new Map([
        [
          "card.comment.added",
          {
            enabled: true,
            customSubject: "Custom subject",
            customBody: null,
            source: "workspace",
          },
        ],
      ]),
    );

    await dispatchNotification(db, {
      event: "card.comment.added",
      actorUserId: ACTOR,
      cardPublicId: "card-public-1",
      commentId: 5,
    });

    const [, subject] = mockSendEmail.mock.calls[0]!;
    expect(subject).toBe("Custom subject");
  });
});

describe("dispatchNotification — Teams channel", () => {
  const ruleMap = (entry: {
    enabled: boolean;
    teamsEnabled: boolean;
    customSubject?: string | null;
  }) =>
    new Map([
      [
        "card.comment.added",
        {
          enabled: entry.enabled,
          teamsEnabled: entry.teamsEnabled,
          customSubject: entry.customSubject ?? null,
          source: "global",
        },
      ],
    ]);

  const commentArgs = {
    event: "card.comment.added" as const,
    actorUserId: ACTOR,
    cardPublicId: "card-public-1",
    commentId: 5,
  };

  beforeEach(() => {
    mockGetCard.mockResolvedValue(
      cardWithMembers([
        { email: "m1@test.com", user: { id: "user-1", name: "M1" } },
      ]),
    );
  });

  it("sends a Teams card when teamsEnabled + bot configured + linked", async () => {
    mockGetResolvedRules.mockResolvedValue(
      ruleMap({ enabled: false, teamsEnabled: true }),
    );
    mockIsTeamsEnabled.mockReturnValue(true);
    mockGetConversation.mockResolvedValue({ conversationReference: "{}" });

    await dispatchNotification(db, commentArgs);

    expect(mockSendProactiveCard).toHaveBeenCalledTimes(1);
    // Email channel was off for this rule.
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not send a Teams card when the bot is not configured", async () => {
    mockGetResolvedRules.mockResolvedValue(
      ruleMap({ enabled: false, teamsEnabled: true }),
    );
    mockIsTeamsEnabled.mockReturnValue(false);
    mockGetConversation.mockResolvedValue({ conversationReference: "{}" });

    await dispatchNotification(db, commentArgs);

    expect(mockSendProactiveCard).not.toHaveBeenCalled();
  });

  it("does not send a Teams card when the recipient has no linked conversation", async () => {
    mockGetResolvedRules.mockResolvedValue(
      ruleMap({ enabled: false, teamsEnabled: true }),
    );
    mockIsTeamsEnabled.mockReturnValue(true);
    mockGetConversation.mockResolvedValue(null);

    await dispatchNotification(db, commentArgs);

    expect(mockSendProactiveCard).not.toHaveBeenCalled();
  });

  it("fans out to both channels independently", async () => {
    mockGetResolvedRules.mockResolvedValue(
      ruleMap({ enabled: true, teamsEnabled: true }),
    );
    mockIsTeamsEnabled.mockReturnValue(true);
    mockGetConversation.mockResolvedValue({ conversationReference: "{}" });

    await dispatchNotification(db, commentArgs);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendProactiveCard).toHaveBeenCalledTimes(1);
  });

  it("a Teams send failure does not block the email channel", async () => {
    mockGetResolvedRules.mockResolvedValue(
      ruleMap({ enabled: true, teamsEnabled: true }),
    );
    mockIsTeamsEnabled.mockReturnValue(true);
    mockGetConversation.mockResolvedValue({ conversationReference: "{}" });
    mockSendProactiveCard.mockRejectedValueOnce(new Error("teams down"));

    await dispatchNotification(db, commentArgs);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
