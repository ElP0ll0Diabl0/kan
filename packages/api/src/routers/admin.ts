import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as adminRepo from "@kan/db/repository/admin.repo";
import * as boardRepo from "@kan/db/repository/board.repo";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";

import { createTRPCRouter, superAdminProcedure } from "../trpc";

const listInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().trim().min(1).optional(),
});

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
});
