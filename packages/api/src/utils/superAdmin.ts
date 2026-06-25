import { env } from "next-runtime-env";

/**
 * Helpers for the instance-level admin area. A "superadmin" is an instance
 * admin with visibility over every workspace — distinct from a workspace
 * "admin" member role. The admin area is self-hosted only.
 */

const getSuperAdminEmails = (): string[] =>
  (env("KAN_SUPERADMIN_EMAILS") ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

/** Whether an email is in the KAN_SUPERADMIN_EMAILS bootstrap allowlist. */
export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase());
};

/**
 * Whether a user is an instance superadmin — either their account role is
 * "admin", or their email is in the bootstrap allowlist. The allowlist is
 * honoured even if the role column says otherwise, so an instance can never
 * lock itself out of the admin area.
 */
export const isSuperAdmin = (
  user?: { email?: string | null; role?: string | null } | null,
): boolean => {
  if (!user) return false;
  return user.role === "admin" || isSuperAdminEmail(user.email);
};

/**
 * The admin area is only available on self-hosted instances, never on the
 * multi-tenant cloud deployment (it would expose other tenants' data).
 */
export const isAdminAreaEnabled = (): boolean =>
  env("NEXT_PUBLIC_KAN_ENV") !== "cloud";
