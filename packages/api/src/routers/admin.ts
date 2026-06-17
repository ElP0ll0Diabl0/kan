import { TRPCError } from "@trpc/server";
import { env } from "next-runtime-env";
import { z } from "zod";

import * as adminRepo from "@kan/db/repository/admin.repo";
import * as boardRepo from "@kan/db/repository/board.repo";
import * as boardMemberRepo from "@kan/db/repository/boardMember.repo";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as pendingBoardMemberRepo from "@kan/db/repository/pendingBoardMember.repo";
import * as permissionRepo from "@kan/db/repository/permission.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";
import { sendEmail } from "@kan/email";
import { createLogger } from "@kan/logger";

import { createTRPCRouter, superAdminProcedure } from "../trpc";

const log = createLogger("admin");

const listInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().trim().min(1).optional(),
});

const workspaceRoleInput = z.enum(["admin", "member", "guest"]);

const boardRoleInput = z.enum(["viewer", "editor", "admin"]);

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
        try {
          const firstBoard = addedBoards[0];
          const ctaUrl = firstBoard
            ? `${baseUrl}/${workspace.slug}/${firstBoard.slug}`
            : `${baseUrl}/${workspace.slug}`;
          await sendEmail(
            existingUser.email,
            `You've been added to ${workspace.name}`,
            "ADDED_TO_WORKSPACE",
            {
              workspaceName: workspace.name,
              inviterName: ctx.user.name ?? "",
              boards: addedBoards.map((board) => board.name).join(", "),
              ctaUrl,
              ctaLabel: firstBoard ? "Open board" : "Open workspace",
            },
          );
        } catch (error) {
          log.error(
            { err: error, email: existingUser.email },
            "Failed to send workspace-add notification email",
          );
        }

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
});
