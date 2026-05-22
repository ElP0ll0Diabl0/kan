import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as adminRepo from "@kan/db/repository/admin.repo";
import * as boardRepo from "@kan/db/repository/board.repo";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as permissionRepo from "@kan/db/repository/permission.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";

import { createTRPCRouter, superAdminProcedure } from "../trpc";

const listInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().trim().min(1).optional(),
});

const workspaceRoleInput = z.enum(["admin", "member", "guest"]);

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
});
