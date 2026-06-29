import { TRPCError } from "@trpc/server";
import { env } from "next-runtime-env";
import { z } from "zod";

import * as ssoConnectionRepo from "@kan/db/repository/ssoConnection.repo";

import {
  createTRPCRouter,
  publicProcedure,
  superAdminProcedure,
} from "../trpc";
import { encryptToken } from "../utils/encryption";

// Slug used in the better-auth oauth2 callback path. Reserved: "oidc" is the
// env-configured provider id.
const providerIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9-]{2,64}$/,
    "Provider id must be 2-64 chars: lowercase letters, numbers, hyphens.",
  )
  .refine((v) => v !== "oidc", {
    message: '"oidc" is reserved for the environment-configured provider.',
  });

const callbackUrlFor = (providerId: string) => {
  const baseUrl = env("NEXT_PUBLIC_BASE_URL") ?? "";
  return `${baseUrl}/api/auth/oauth2/callback/${providerId}`;
};

export const ssoRouter = createTRPCRouter({
  // --- Admin: manage connections (secret never returned) ---
  list: superAdminProcedure.input(z.void()).query(async ({ ctx }) => {
    const rows = await ssoConnectionRepo.list(ctx.db);
    return rows.map((r) => ({
      publicId: r.publicId,
      type: r.type,
      providerId: r.providerId,
      name: r.name,
      enabled: r.enabled,
      clientId: r.clientId,
      discoveryUrl: r.discoveryUrl,
      scopes: r.scopes,
      domain: r.domain,
      hasClientSecret: !!r.clientSecret,
      callbackUrl: callbackUrlFor(r.providerId),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }),

  create: superAdminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        providerId: providerIdSchema,
        discoveryUrl: z.string().trim().url().max(2048),
        clientId: z.string().trim().min(1).max(255),
        clientSecret: z.string().min(1),
        scopes: z.string().trim().max(512).optional(),
        domain: z.string().trim().max(255).optional(),
        enabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ssoConnectionRepo.getByProviderId(
        ctx.db,
        input.providerId,
      );
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A connection with provider id "${input.providerId}" already exists.`,
        });
      }

      const created = await ssoConnectionRepo.create(ctx.db, {
        type: "oidc",
        providerId: input.providerId,
        name: input.name,
        enabled: input.enabled,
        clientId: input.clientId,
        clientSecret: encryptToken(input.clientSecret),
        discoveryUrl: input.discoveryUrl,
        scopes: input.scopes?.trim() ? input.scopes.trim() : null,
        domain: input.domain?.trim() ? input.domain.trim() : null,
        createdBy: ctx.user.id,
      });

      return { publicId: created?.publicId };
    }),

  // providerId is immutable (it's baked into the registered callback URL).
  update: superAdminProcedure
    .input(
      z.object({
        publicId: z.string().min(12),
        name: z.string().trim().min(1).max(255),
        discoveryUrl: z.string().trim().url().max(2048),
        clientId: z.string().trim().min(1).max(255),
        clientSecret: z.string().min(1).optional(),
        scopes: z.string().trim().max(512).optional(),
        domain: z.string().trim().max(255).optional(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ssoConnectionRepo.getByPublicId(
        ctx.db,
        input.publicId,
      );
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }

      await ssoConnectionRepo.update(ctx.db, input.publicId, {
        type: existing.type,
        name: input.name,
        enabled: input.enabled,
        clientId: input.clientId,
        clientSecret: input.clientSecret
          ? encryptToken(input.clientSecret)
          : undefined,
        discoveryUrl: input.discoveryUrl,
        scopes: input.scopes?.trim() ? input.scopes.trim() : null,
        domain: input.domain?.trim() ? input.domain.trim() : null,
      });

      return { success: true };
    }),

  delete: superAdminProcedure
    .input(z.object({ publicId: z.string().min(12) }))
    .mutation(async ({ ctx, input }) => {
      await ssoConnectionRepo.remove(ctx.db, input.publicId);
      return { success: true };
    }),

  // --- Public: enabled connections for the login page (no secrets) ---
  listForLogin: publicProcedure
    .input(z.void())
    .output(
      z.array(z.object({ providerId: z.string(), name: z.string() })),
    )
    .query(async ({ ctx }) => {
      const rows = await ssoConnectionRepo.listEnabled(ctx.db);
      return rows
        .filter((r) => r.type === "oidc" && r.clientId && r.discoveryUrl)
        .map((r) => ({ providerId: r.providerId, name: r.name }));
    }),
});
