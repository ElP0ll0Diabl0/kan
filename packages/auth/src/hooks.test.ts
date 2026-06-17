import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-runtime-env", () => ({
  env: vi.fn(),
}));

vi.mock("@kan/db/repository/member.repo", () => ({
  getByEmailAndStatus: vi.fn(),
  getByPublicId: vi.fn(),
  acceptInvite: vi.fn(),
}));

vi.mock("@kan/db/repository/user.repo", () => ({
  update: vi.fn(),
}));

vi.mock("@kan/db/repository/board.repo", () => ({
  getAccessById: vi.fn(),
}));

vi.mock("@kan/db/repository/boardMember.repo", () => ({
  getByBoardAndUser: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@kan/db/repository/pendingBoardMember.repo", () => ({
  listByWorkspaceMemberId: vi.fn(),
  deleteByWorkspaceMemberId: vi.fn(),
}));

vi.mock("@kan/email", () => ({
  notificationClient: null,
}));

vi.mock("@kan/shared", () => ({
  createEmailUnsubscribeLink: vi.fn(),
  createS3Client: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn(),
}));

vi.mock("@novu/api/models/components", () => ({
  ChatOrPushProviderEnum: { Discord: "discord" },
}));

import { env } from "next-runtime-env";
import * as boardRepo from "@kan/db/repository/board.repo";
import * as boardMemberRepo from "@kan/db/repository/boardMember.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as pendingBoardMemberRepo from "@kan/db/repository/pendingBoardMember.repo";
import { applyPendingBoardMembers, createDatabaseHooks } from "./hooks";

const mockEnv = env as ReturnType<typeof vi.fn>;
const mockGetByEmailAndStatus =
  memberRepo.getByEmailAndStatus as ReturnType<typeof vi.fn>;
const mockGetAccessById = boardRepo.getAccessById as ReturnType<typeof vi.fn>;
const mockGetByBoardAndUser =
  boardMemberRepo.getByBoardAndUser as ReturnType<typeof vi.fn>;
const mockBoardMemberCreate =
  boardMemberRepo.create as ReturnType<typeof vi.fn>;
const mockListPending =
  pendingBoardMemberRepo.listByWorkspaceMemberId as ReturnType<typeof vi.fn>;
const mockDeletePending =
  pendingBoardMemberRepo.deleteByWorkspaceMemberId as ReturnType<typeof vi.fn>;

const db = {} as Parameters<typeof createDatabaseHooks>[0];

const fakeUser = {
  id: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  email: "test@example.com",
  emailVerified: false,
  name: "Test User",
};

describe("createDatabaseHooks", () => {
  const hooks = createDatabaseHooks(db);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("user.create.before", () => {
    it("allows sign-up when DISABLE_SIGN_UP is not set", async () => {
      mockEnv.mockReturnValue(undefined);

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(true);
      expect(mockGetByEmailAndStatus).not.toHaveBeenCalled();
    });

    it("allows sign-up when DISABLE_SIGN_UP is false", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "false" : undefined,
      );

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(true);
      expect(mockGetByEmailAndStatus).not.toHaveBeenCalled();
    });

    it("blocks sign-up when disabled and user has no pending invitation", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      mockGetByEmailAndStatus.mockResolvedValue(undefined);

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(false);
      expect(mockGetByEmailAndStatus).toHaveBeenCalledWith(
        db,
        "test@example.com",
        "invited",
      );
    });

    it("allows sign-up when disabled but user has a pending invitation", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-1",
        email: "test@example.com",
        status: "invited",
      });

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(true);
      expect(mockGetByEmailAndStatus).toHaveBeenCalledWith(
        db,
        "test@example.com",
        "invited",
      );
    });

    it("blocks sign-up when disabled and invitation exists but domain is not allowed", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      process.env.BETTER_AUTH_ALLOWED_DOMAINS = "acme.com";
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-1",
        email: "test@example.com",
        status: "invited",
      });

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(false);

      delete process.env.BETTER_AUTH_ALLOWED_DOMAINS;
    });

    // The user.create.before hook fires for ALL sign-up paths including
    // OIDC/social — verify invite bypass works regardless of auth method.
    it("allows OIDC/social sign-up when disabled but user has a pending invitation", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      const oidcUser = {
        ...fakeUser,
        id: "user-oidc",
        email: "sso@corp.com",
        image: "https://provider.com/avatar.jpg",
      };
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-2",
        email: "sso@corp.com",
        status: "invited",
      });

      const result = await hooks.user.create.before(oidcUser, {});
      expect(result).toBe(true);
      expect(mockGetByEmailAndStatus).toHaveBeenCalledWith(
        db,
        "sso@corp.com",
        "invited",
      );
    });

    it("blocks OIDC/social sign-up when disabled and user has no pending invitation", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      const oidcUser = {
        ...fakeUser,
        id: "user-oidc",
        email: "random@external.com",
        image: "https://provider.com/avatar.jpg",
      };
      mockGetByEmailAndStatus.mockResolvedValue(undefined);

      const result = await hooks.user.create.before(oidcUser, {});
      expect(result).toBe(false);
      expect(mockGetByEmailAndStatus).toHaveBeenCalledWith(
        db,
        "random@external.com",
        "invited",
      );
    });

    it("allows sign-up when disabled, invitation exists, and domain is allowed", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      process.env.BETTER_AUTH_ALLOWED_DOMAINS = "example.com";
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-1",
        email: "test@example.com",
        status: "invited",
      });

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(true);

      delete process.env.BETTER_AUTH_ALLOWED_DOMAINS;
    });
  });
});

describe("applyPendingBoardMembers", () => {
  const db = {} as Parameters<typeof applyPendingBoardMembers>[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates board memberships for still-restricted boards then clears pending rows", async () => {
    mockListPending.mockResolvedValue([
      { id: 1, boardId: 10, role: "editor" },
      { id: 2, boardId: 20, role: "admin" },
    ]);
    mockGetAccessById.mockResolvedValue({
      id: 10,
      accessLevel: "restricted",
      workspaceId: 1,
    });
    mockGetByBoardAndUser.mockResolvedValue(undefined);

    await applyPendingBoardMembers(db, {
      workspaceMemberId: 5,
      userId: "user-1",
      createdBy: "admin-1",
    });

    expect(mockBoardMemberCreate).toHaveBeenCalledTimes(2);
    expect(mockBoardMemberCreate).toHaveBeenCalledWith(db, {
      boardId: 10,
      userId: "user-1",
      role: "editor",
      createdBy: "admin-1",
    });
    expect(mockDeletePending).toHaveBeenCalledWith(db, 5);
  });

  it("skips boards that no longer exist or are no longer restricted", async () => {
    mockListPending.mockResolvedValue([
      { id: 1, boardId: 10, role: "editor" }, // missing
      { id: 2, boardId: 20, role: "viewer" }, // now workspace-access
    ]);
    mockGetAccessById.mockImplementation((_db, boardId: number) =>
      boardId === 20
        ? Promise.resolve({ id: 20, accessLevel: "workspace", workspaceId: 1 })
        : Promise.resolve(undefined),
    );
    mockGetByBoardAndUser.mockResolvedValue(undefined);

    await applyPendingBoardMembers(db, {
      workspaceMemberId: 5,
      userId: "user-1",
      createdBy: "admin-1",
    });

    expect(mockBoardMemberCreate).not.toHaveBeenCalled();
    expect(mockDeletePending).toHaveBeenCalledWith(db, 5);
  });

  it("skips boards where the user is already a member", async () => {
    mockListPending.mockResolvedValue([
      { id: 1, boardId: 10, role: "editor" },
    ]);
    mockGetAccessById.mockResolvedValue({
      id: 10,
      accessLevel: "restricted",
      workspaceId: 1,
    });
    mockGetByBoardAndUser.mockResolvedValue({ id: 99 });

    await applyPendingBoardMembers(db, {
      workspaceMemberId: 5,
      userId: "user-1",
      createdBy: "admin-1",
    });

    expect(mockBoardMemberCreate).not.toHaveBeenCalled();
    expect(mockDeletePending).toHaveBeenCalledWith(db, 5);
  });

  it("falls back to the userId as createdBy when the inviter is unknown", async () => {
    mockListPending.mockResolvedValue([
      { id: 1, boardId: 10, role: "viewer" },
    ]);
    mockGetAccessById.mockResolvedValue({
      id: 10,
      accessLevel: "restricted",
      workspaceId: 1,
    });
    mockGetByBoardAndUser.mockResolvedValue(undefined);

    await applyPendingBoardMembers(db, {
      workspaceMemberId: 5,
      userId: "user-1",
      createdBy: null,
    });

    expect(mockBoardMemberCreate).toHaveBeenCalledWith(db, {
      boardId: 10,
      userId: "user-1",
      role: "viewer",
      createdBy: "user-1",
    });
  });

  it("does nothing destructive when there are no pending rows", async () => {
    mockListPending.mockResolvedValue([]);

    await applyPendingBoardMembers(db, {
      workspaceMemberId: 5,
      userId: "user-1",
      createdBy: "admin-1",
    });

    expect(mockBoardMemberCreate).not.toHaveBeenCalled();
    expect(mockDeletePending).toHaveBeenCalledWith(db, 5);
  });
});
