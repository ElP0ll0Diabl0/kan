import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "next-runtime-env";

import type { dbClient } from "@kan/db/client";
import * as schema from "@kan/db/schema";
import { sendEmail } from "@kan/email";

import { createDatabaseHooks, createMiddlewareHooks } from "./hooks";
import { createPlugins } from "./plugins";
import { configuredProviders } from "./providers";

export const initAuth = (db: dbClient) => {
  const baseURL = env("NEXT_PUBLIC_BASE_URL") || env("BETTER_AUTH_URL");
  const trustedOrigins =
    env("BETTER_AUTH_TRUSTED_ORIGINS")?.split(",").filter(Boolean) ?? [];

  return betterAuth({
    secret: env("BETTER_AUTH_SECRET"),
    baseURL,
    trustedOrigins: [...(baseURL ? [baseURL] : []), ...trustedOrigins],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        ...schema,
        user: schema.users,
      },
    }),
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24 * 2, // Update session expiry every 48 hours if user is active
      freshAge: 0,
    },
    emailAndPassword: {
      enabled: env("NEXT_PUBLIC_ALLOW_CREDENTIALS")?.toLowerCase() === "true",
      // Sign-up restriction is handled by the user.create.before database
      // hook which checks for pending invitations, allowing invited users
      // to register even when public sign-up is disabled.
      disableSignUp: false,
      sendResetPassword: async (data) => {
        await sendEmail(data.user.email, "Reset Password", "RESET_PASSWORD", {
          resetPasswordUrl: data.url,
          resetPasswordToken: data.token,
        });
      },
    },
    socialProviders: configuredProviders,
    account: {
      // Entra/Microsoft does not return an `email_verified` claim, so better
      // auth's default link gate (untrusted provider AND unverified profile
      // email) blocks linking a Microsoft login to an existing same-email
      // user. Trusting the provider lets the OAuth identity link onto the
      // existing account. Safe here: linking is same-email-only
      // (allowDifferentEmails stays false) and social sign-ups are already
      // gated to the org's tenant-verified domain via BETTER_AUTH_ALLOWED_DOMAINS.
      accountLinking: {
        enabled: true,
        trustedProviders: ["microsoft"],
      },
    },
    user: {
      deleteUser: {
        enabled: true,
      },
      additionalFields: {
        stripeCustomerId: {
          type: "string",
          required: false,
          defaultValue: null,
          input: false,
        },
        // Entra ID directory object id (the `oid` claim), captured at
        // Microsoft/OIDC sign-in. Used to auto-link a Teams identity
        // (activity.from.aadObjectId) to the Kan user.
        entraObjectId: {
          type: "string",
          required: false,
          defaultValue: null,
          input: false,
        },
      },
    },
    plugins: createPlugins(db),
    databaseHooks: createDatabaseHooks(db),
    hooks: createMiddlewareHooks(db),
    advanced: {
      cookiePrefix: "kan",
      database: {
        generateId: false,
      },
    },
  });
};
