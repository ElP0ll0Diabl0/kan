import { TRPCError } from "@trpc/server";
import { env } from "next-runtime-env";
import { z } from "zod";

import * as adminRepo from "@kan/db/repository/admin.repo";
import * as boardRepo from "@kan/db/repository/board.repo";
import * as boardMemberRepo from "@kan/db/repository/boardMember.repo";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as notificationRuleRepo from "@kan/db/repository/notificationRule.repo";
import * as pendingBoardMemberRepo from "@kan/db/repository/pendingBoardMember.repo";
import * as permissionRepo from "@kan/db/repository/permission.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";
import { notificationEventTypes } from "@kan/db/schema";
import { createLogger } from "@kan/logger";

import { createTRPCRouter, superAdminProcedure } from "../trpc";
import {
  dispatchNotification,
  EVENT_DEFAULT_ENABLED,
  EVENT_DEFAULT_TEAMS_ENABLED,
} from "../utils/notifications";
import { isSuperAdminEmail } from "../utils/superAdmin";

const log = createLogger("admin");

const isCredentialsEnabled = () =>
  env("NEXT_PUBLIC_ALLOW_CREDENTIALS")?.toLowerCase() === "true";

const listInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().trim().min(1).optional(),
});

const workspaceRoleInput = z.enum(["admin", "member", "guest"]);

const boardRoleInput = z.enum(["viewer", "editor", "admin"]);

const notificationEventInput = z.enum(
  notificationEventTypes as unknown as [string, ...string[]],
);

// Empty subject clears the override (falls back to the built-in default).
const customSubjectInput = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => (value ? value : null));

// Empty strings from form inputs clear the field (stored as NULL).
const optionalProfileField = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => (value ? value : null));

/**
 * Instance admin router. Every procedure is gated by {@link superAdminProcedure}
 * (authenticated instance superadmin, self-hosted only). Output schemas are
 * intentionally omitted — these are internal, UI-only queries and the shapes
 * are inferred from the repository layer.
 */
export const adminRouter = createTRPCRouter({
  getStats: superAdminProcedure.input(z.void()).query(async ({ ctx }) => {
    const [users, workspaces, boards, cards] = await Promise.all([
      userRepo.getCount(ctx.db),
      workspaceRepo.getCount(ctx.db),
      boardRepo.getCount(ctx.db),
      cardRepo.getCount(ctx.db),
    ]);

    return { users, workspaces, boards, cards };
  }),

  listWorkspaces: superAdminProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => {
      return adminRepo.listWorkspaces(ctx.db, input);
    }),

  getWorkspace: superAdminProcedure
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .query(async ({ ctx, input }) => {
      const workspace = await adminRepo.getWorkspaceOverview(
        ctx.db,
        input.workspacePublicId,
      );

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workspace with public ID ${input.workspacePublicId} not found`,
        });
      }

      return workspace;
    }),

  listUsers: superAdminProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => {
      return adminRepo.listUsers(ctx.db, input);
    }),

  getUser: superAdminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await adminRepo.getUserOverview(ctx.db, input.userId);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User with ID ${input.userId} not found`,
        });
      }

      return user;
    }),

  /** Promote or demote a user's instance-level (superadmin) role. */
  setUserRole: superAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(["user", "admin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role",
        });
      }

      const user = await userRepo.getById(ctx.db, input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await userRepo.updateRole(ctx.db, input.userId, input.role);

      return { success: true };
    }),

  banUser: superAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        reason: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot ban yourself",
        });
      }

      const user = await userRepo.getById(ctx.db, input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await userRepo.setBanned(ctx.db, input.userId, {
        banned: true,
        banReason: input.reason ?? null,
      });
      // Revoke active sessions so the ban takes effect immediately.
      await userRepo.clearSessions(ctx.db, input.userId);

      return { success: true };
    }),

  unbanUser: superAdminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const user = await userRepo.getById(ctx.db, input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await userRepo.setBanned(ctx.db, input.userId, { banned: false });

      return { success: true };
    }),

  /** Add an existing user to any workspace as an active member. */
  addWorkspaceMember: superAdminProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        userId: z.string().uuid(),
        role: workspaceRoleInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const user = await userRepo.getById(ctx.db, input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const isAlreadyMember = await workspaceRepo.isUserInWorkspace(
        ctx.db,
        input.userId,
        workspace.id,
      );
      if (isAlreadyMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this workspace",
        });
      }

      const role = await permissionRepo.getRoleByWorkspaceIdAndName(
        ctx.db,
        workspace.id,
        input.role,
      );

      await memberRepo.create(ctx.db, {
        workspaceId: workspace.id,
        email: user.email,
        userId: user.id,
        createdBy: ctx.user.id,
        role: input.role,
        roleId: role?.id ?? null,
        status: "active",
      });

      const baseUrl = env("NEXT_PUBLIC_BASE_URL");
      dispatchNotification(ctx.db, {
        event: "workspace.member.added",
        actorUserId: ctx.user.id,
        workspaceId: workspace.id,
        targetUserId: user.id,
        workspaceName: workspace.name,
        inviterName: ctx.user.name ?? "",
        ctaUrl: `${baseUrl}/${workspace.slug}`,
        ctaLabel: "Open workspace",
      }).catch((error) => {
        log.error(
          { err: error, userId: user.id },
          "Failed to dispatch workspace.member.added notification",
        );
      });

      return { success: true };
    }),

  /**
   * Invites a user (by email) into a workspace with an optional set of
   * restricted-board grants.
   *
   * - If the email already has an account, they are added immediately as an
   *   active member, board memberships are applied right away, and a
   *   notification email is sent.
   * - Otherwise a magic-link invite is sent (status "invited"). The board
   *   grants are parked in pending_board_members and applied when the user
   *   accepts the invite (see applyPendingBoardMembers in @kan/auth hooks).
   */
  inviteMember: superAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        workspacePublicId: z.string().min(12),
        workspaceRole: workspaceRoleInput.default("member"),
        boards: z
          .array(
            z.object({
              boardPublicId: z.string().min(12),
              role: boardRoleInput,
            }),
          )
          .max(50)
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      // De-dupe board selections, keeping the first role specified per board.
      const requestedBoards = new Map<string, (typeof input.boards)[number]>();
      for (const board of input.boards) {
        if (!requestedBoards.has(board.boardPublicId)) {
          requestedBoards.set(board.boardPublicId, board);
        }
      }

      // Validate every requested board up front, before any writes.
      const boardMeta = await boardRepo.getAccessAndMetaByPublicIds(
        ctx.db,
        [...requestedBoards.keys()],
      );
      const boardMetaByPublicId = new Map(
        boardMeta.map((board) => [board.publicId, board]),
      );

      const resolvedBoards = [...requestedBoards.values()].map((requested) => {
        const meta = boardMetaByPublicId.get(requested.boardPublicId);
        if (!meta) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Board ${requested.boardPublicId} not found`,
          });
        }
        if (meta.workspaceId !== workspace.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Board does not belong to the selected workspace",
          });
        }
        if (meta.accessLevel !== "restricted") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Board members can only be managed on restricted boards. " +
              "Workspace-access boards are open to all workspace members.",
          });
        }
        return {
          boardId: meta.id,
          role: requested.role,
          name: meta.name,
          slug: meta.slug,
        };
      });

      const existingUser = await userRepo.getByEmail(ctx.db, input.email);

      // Guard against duplicate workspace membership / pending invite.
      if (existingUser) {
        const isAlreadyMember = await workspaceRepo.isUserInWorkspace(
          ctx.db,
          existingUser.id,
          workspace.id,
        );
        if (isAlreadyMember) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member of this workspace",
          });
        }
      }

      const existingInvite = await memberRepo.getByEmailWorkspaceAndStatus(
        ctx.db,
        input.email,
        workspace.id,
        "invited",
      );
      if (existingInvite) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email already has a pending invite to this workspace",
        });
      }

      const role = await permissionRepo.getRoleByWorkspaceIdAndName(
        ctx.db,
        workspace.id,
        input.workspaceRole,
      );

      const baseUrl = env("NEXT_PUBLIC_BASE_URL");

      // ── Existing account: add immediately ──────────────────────────────
      if (existingUser) {
        await memberRepo.create(ctx.db, {
          workspaceId: workspace.id,
          email: existingUser.email,
          userId: existingUser.id,
          createdBy: ctx.user.id,
          role: input.workspaceRole,
          roleId: role?.id ?? null,
          status: "active",
        });

        const addedBoards: { name: string; slug: string }[] = [];
        for (const board of resolvedBoards) {
          const alreadyMember = await boardMemberRepo.getByBoardAndUser(
            ctx.db,
            board.boardId,
            existingUser.id,
          );
          if (alreadyMember) continue;

          await boardMemberRepo.create(ctx.db, {
            boardId: board.boardId,
            userId: existingUser.id,
            role: board.role,
            createdBy: ctx.user.id,
          });
          addedBoards.push({ name: board.name, slug: board.slug });
        }

        // Notification is best-effort — the membership is the source of truth.
        // Routed through the dispatcher so it obeys the admin's notification
        // rules (workspace.member.added).
        const firstBoard = addedBoards[0];
        const ctaUrl = firstBoard
          ? `${baseUrl}/${workspace.slug}/${firstBoard.slug}`
          : `${baseUrl}/${workspace.slug}`;
        dispatchNotification(ctx.db, {
          event: "workspace.member.added",
          actorUserId: ctx.user.id,
          workspaceId: workspace.id,
          targetUserId: existingUser.id,
          workspaceName: workspace.name,
          inviterName: ctx.user.name ?? "",
          boards: addedBoards.map((board) => board.name).join(", "),
          ctaUrl,
          ctaLabel: firstBoard ? "Open board" : "Open workspace",
        }).catch((error) => {
          log.error(
            { err: error, email: existingUser.email },
            "Failed to dispatch workspace.member.added notification",
          );
        });

        return { success: true, status: "active" as const };
      }

      // ── New account: magic-link invite, defer board grants ─────────────
      const invite = await memberRepo.create(ctx.db, {
        workspaceId: workspace.id,
        email: input.email,
        userId: null,
        createdBy: ctx.user.id,
        role: input.workspaceRole,
        roleId: role?.id ?? null,
        status: "invited",
      });

      if (!invite) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Unable to invite user with email ${input.email}`,
        });
      }

      if (resolvedBoards.length) {
        await pendingBoardMemberRepo.createMany(ctx.db, {
          workspaceMemberId: invite.id,
          createdBy: ctx.user.id,
          boards: resolvedBoards.map((board) => ({
            boardId: board.boardId,
            role: board.role,
          })),
        });
      }

      const { status } = await ctx.auth.api.signInMagicLink({
        email: input.email,
        callbackURL: `/boards?type=invite&memberPublicId=${invite.publicId}`,
      });

      if (!status) {
        // Roll back: soft-delete won't cascade pending rows, so clear them too.
        await pendingBoardMemberRepo.deleteByWorkspaceMemberId(
          ctx.db,
          invite.id,
        );
        await memberRepo.softDelete(ctx.db, {
          memberId: invite.id,
          deletedAt: new Date(),
          deletedBy: ctx.user.id,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send invitation to ${input.email}`,
        });
      }

      return { success: true, status: "invited" as const };
    }),

  removeWorkspaceMember: superAdminProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        memberPublicId: z.string().min(12),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const member = await memberRepo.getByPublicId(
        ctx.db,
        input.memberPublicId,
      );
      if (!member || member.workspaceId !== workspace.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      await memberRepo.softDelete(ctx.db, {
        memberId: member.id,
        deletedAt: new Date(),
        deletedBy: ctx.user.id,
      });

      if (member.userId) {
        dispatchNotification(ctx.db, {
          event: "workspace.member.removed",
          actorUserId: ctx.user.id,
          workspaceId: workspace.id,
          targetUserId: member.userId,
          workspaceName: workspace.name,
          actorName: ctx.user.name ?? "",
        }).catch((error) => {
          log.error(
            { err: error, memberId: member.id },
            "Failed to dispatch workspace.member.removed notification",
          );
        });
      }

      return { success: true };
    }),

  updateWorkspaceMemberRole: superAdminProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        memberPublicId: z.string().min(12),
        role: workspaceRoleInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const member = await memberRepo.getByPublicId(
        ctx.db,
        input.memberPublicId,
      );
      if (!member || member.workspaceId !== workspace.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      const role = await permissionRepo.getRoleByWorkspaceIdAndName(
        ctx.db,
        workspace.id,
        input.role,
      );

      await memberRepo.updateRole(ctx.db, {
        memberId: member.id,
        role: input.role,
        roleId: role?.id ?? null,
      });

      if (member.userId) {
        dispatchNotification(ctx.db, {
          event: "workspace.role.changed",
          actorUserId: ctx.user.id,
          workspaceId: workspace.id,
          targetUserId: member.userId,
          workspaceName: workspace.name,
          newRole: input.role,
          actorName: ctx.user.name ?? "",
        }).catch((error) => {
          log.error(
            { err: error, memberId: member.id },
            "Failed to dispatch workspace.role.changed notification",
          );
        });
      }

      return { success: true };
    }),

  updateUserProfile: superAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        name: z.string().trim().min(1).max(255).optional(),
        department: optionalProfileField,
        title: optionalProfileField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await userRepo.getById(ctx.db, input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await userRepo.update(ctx.db, input.userId, {
        name: input.name,
        department: input.department,
        title: input.title,
      });

      return { success: true };
    }),

  // Directly sets a user's password (better-auth admin plugin). Only usable
  // when credentials auth is enabled. The admin relays the password to the
  // user, who can change it later in Settings.
  setUserPassword: superAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isCredentialsEnabled()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Password auth is disabled. Set NEXT_PUBLIC_ALLOW_CREDENTIALS to enable it.",
        });
      }

      const user = await userRepo.getById(ctx.db, input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // The better-auth admin plugin gates setUserPassword on the caller's DB
      // role being "admin", whereas superAdminProcedure also admits emails in
      // the KAN_SUPERADMIN_EMAILS allowlist. Reconcile the two: if the caller
      // is an allowlisted superadmin who was never promoted (e.g. added to the
      // allowlist after sign-up), promote them now so the plugin call succeeds.
      if (ctx.user.role !== "admin" && isSuperAdminEmail(ctx.user.email)) {
        await userRepo.updateRole(ctx.db, ctx.user.id, "admin");
      }

      await ctx.auth.api.setUserPassword({
        userId: input.userId,
        newPassword: input.newPassword,
      });

      return { success: true };
    }),

  // Emails the user a password-reset link (better-auth requestPasswordReset).
  // The link lands on /reset-password with the forwarded token.
  sendPasswordReset: superAdminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!isCredentialsEnabled()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Password auth is disabled. Set NEXT_PUBLIC_ALLOW_CREDENTIALS to enable it.",
        });
      }

      const user = await userRepo.getById(ctx.db, input.userId);
      if (!user?.email) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await ctx.auth.api.requestPasswordReset({
        email: user.email,
        redirectTo: "/reset-password",
      });

      return { success: true };
    }),

  // Lists every restricted board in a workspace together with the target
  // user's board membership (if any), so an admin can manage board scope.
  listUserBoardScope: superAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        workspacePublicId: z.string().min(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return boardRepo.getRestrictedBoardsWithUserMembershipByWorkspaceId(
        ctx.db,
        workspace.id,
        input.userId,
      );
    }),

  // Restricted boards in a workspace, for the invite modal's board picker.
  listRestrictedBoards: superAdminProcedure
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .query(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return boardRepo.listRestrictedByWorkspaceId(ctx.db, workspace.id);
    }),

  addBoardMember: superAdminProcedure
    .input(
      z.object({
        boardPublicId: z.string().min(12),
        userId: z.string().uuid(),
        role: boardRoleInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await boardRepo.getAccessByPublicId(
        ctx.db,
        input.boardPublicId,
      );
      if (!board) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
      }
      if (board.accessLevel !== "restricted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Board members can only be managed on restricted boards. " +
            "Workspace-access boards are open to all workspace members.",
        });
      }

      const isInWorkspace = await workspaceRepo.isUserInWorkspace(
        ctx.db,
        input.userId,
        board.workspaceId,
      );
      if (!isInWorkspace) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is not a member of this board's workspace",
        });
      }

      const existing = await boardMemberRepo.getByBoardAndUser(
        ctx.db,
        board.id,
        input.userId,
      );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this board",
        });
      }

      await boardMemberRepo.create(ctx.db, {
        boardId: board.id,
        userId: input.userId,
        role: input.role,
        createdBy: ctx.user.id,
      });

      const [boardMeta] = await boardRepo.getAccessAndMetaByPublicIds(ctx.db, [
        input.boardPublicId,
      ]);
      dispatchNotification(ctx.db, {
        event: "board.access.granted",
        actorUserId: ctx.user.id,
        workspaceId: board.workspaceId,
        targetUserId: input.userId,
        boardName: boardMeta?.name ?? "a board",
        actorName: ctx.user.name ?? "",
      }).catch((error) => {
        log.error(
          { err: error, userId: input.userId },
          "Failed to dispatch board.access.granted notification",
        );
      });

      return { success: true };
    }),

  updateBoardMemberRole: superAdminProcedure
    .input(
      z.object({
        boardPublicId: z.string().min(12),
        boardMemberPublicId: z.string().min(12),
        role: boardRoleInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await boardRepo.getAccessByPublicId(
        ctx.db,
        input.boardPublicId,
      );
      if (!board) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
      }

      const boardMember = await boardMemberRepo.getByPublicId(
        ctx.db,
        input.boardMemberPublicId,
      );
      if (
        !boardMember ||
        boardMember.boardId !== board.id ||
        boardMember.deletedAt
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board member not found",
        });
      }

      await boardMemberRepo.updateRole(ctx.db, {
        boardMemberId: boardMember.id,
        role: input.role,
      });

      return { success: true };
    }),

  removeBoardMember: superAdminProcedure
    .input(
      z.object({
        boardPublicId: z.string().min(12),
        boardMemberPublicId: z.string().min(12),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await boardRepo.getAccessByPublicId(
        ctx.db,
        input.boardPublicId,
      );
      if (!board) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
      }

      const boardMember = await boardMemberRepo.getByPublicId(
        ctx.db,
        input.boardMemberPublicId,
      );
      if (
        !boardMember ||
        boardMember.boardId !== board.id ||
        boardMember.deletedAt
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board member not found",
        });
      }

      await boardMemberRepo.softDelete(ctx.db, {
        boardMemberId: boardMember.id,
        deletedAt: new Date(),
        deletedBy: ctx.user.id,
      });

      return { success: true };
    }),

  // ── Notification rules ────────────────────────────────────────────────
  // Global defaults: for every event in the catalog, return the effective
  // enabled state (global rule if present, else the compiled default) plus any
  // global custom subject.
  listGlobalNotificationRules: superAdminProcedure
    .input(z.void())
    .query(async ({ ctx }) => {
      const rules = await notificationRuleRepo.listGlobalRules(ctx.db);
      const byEvent = new Map(rules.map((rule) => [rule.eventType, rule]));

      return notificationEventTypes.map((eventType) => {
        const rule = byEvent.get(eventType);
        return {
          eventType,
          enabled: rule ? rule.enabled : EVENT_DEFAULT_ENABLED[eventType],
          teamsEnabled: rule
            ? rule.teamsEnabled
            : EVENT_DEFAULT_TEAMS_ENABLED[eventType],
          customSubject: rule?.customSubject ?? null,
          hasRule: !!rule,
        };
      });
    }),

  upsertGlobalNotificationRule: superAdminProcedure
    .input(
      z.object({
        eventType: notificationEventInput,
        enabled: z.boolean(),
        teamsEnabled: z.boolean(),
        customSubject: customSubjectInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await notificationRuleRepo.upsertRule(ctx.db, {
        workspaceId: null,
        eventType: input.eventType as (typeof notificationEventTypes)[number],
        enabled: input.enabled,
        teamsEnabled: input.teamsEnabled,
        customSubject: input.customSubject,
        createdBy: ctx.user.id,
      });

      return { success: true };
    }),

  // Per-workspace overrides: for every event return the global effective state
  // plus the workspace override (if any). The view shows the override when
  // present and otherwise inherits the global default.
  getWorkspaceNotificationRules: superAdminProcedure
    .input(z.object({ workspacePublicId: z.string().min(12) }))
    .query(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const [globalRules, workspaceRules] = await Promise.all([
        notificationRuleRepo.listGlobalRules(ctx.db),
        notificationRuleRepo.listWorkspaceRules(ctx.db, workspace.id),
      ]);
      const globalByEvent = new Map(globalRules.map((r) => [r.eventType, r]));
      const wsByEvent = new Map(workspaceRules.map((r) => [r.eventType, r]));

      return notificationEventTypes.map((eventType) => {
        const globalRule = globalByEvent.get(eventType);
        const override = wsByEvent.get(eventType);
        return {
          eventType,
          global: {
            enabled: globalRule
              ? globalRule.enabled
              : EVENT_DEFAULT_ENABLED[eventType],
            teamsEnabled: globalRule
              ? globalRule.teamsEnabled
              : EVENT_DEFAULT_TEAMS_ENABLED[eventType],
            customSubject: globalRule?.customSubject ?? null,
          },
          override: override
            ? {
                enabled: override.enabled,
                teamsEnabled: override.teamsEnabled,
                customSubject: override.customSubject,
              }
            : null,
        };
      });
    }),

  upsertWorkspaceNotificationRule: superAdminProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        eventType: notificationEventInput,
        enabled: z.boolean(),
        teamsEnabled: z.boolean(),
        customSubject: customSubjectInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      await notificationRuleRepo.upsertRule(ctx.db, {
        workspaceId: workspace.id,
        eventType: input.eventType as (typeof notificationEventTypes)[number],
        enabled: input.enabled,
        teamsEnabled: input.teamsEnabled,
        customSubject: input.customSubject,
        createdBy: ctx.user.id,
      });

      return { success: true };
    }),

  // Removes a workspace override so the event falls back to the global default.
  deleteWorkspaceNotificationRule: superAdminProcedure
    .input(
      z.object({
        workspacePublicId: z.string().min(12),
        eventType: notificationEventInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceRepo.getByPublicId(
        ctx.db,
        input.workspacePublicId,
      );
      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      await notificationRuleRepo.deleteWorkspaceRule(ctx.db, {
        workspaceId: workspace.id,
        eventType: input.eventType as (typeof notificationEventTypes)[number],
      });

      return { success: true };
    }),
});
