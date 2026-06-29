import {
  bigserial,
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

// Instance-level SSO connections, configurable from the admin UI. Phase 2
// supports OIDC (via better-auth's genericOAuth); the `type` discriminator and
// nullable provider-specific columns leave room for SAML in a later phase. The
// client secret is stored AES-256-GCM encrypted.
export const ssoConnections = pgTable("sso_connection", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  publicId: varchar("publicId", { length: 12 }).notNull().unique(),
  // "oidc" today; "saml" later. Discriminates the columns below.
  type: varchar("type", { length: 16 }).notNull().default("oidc"),
  // Stable slug used in the better-auth oauth2 callback path
  // (/api/auth/oauth2/callback/{providerId}). Unique across connections.
  providerId: varchar("providerId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  // --- OIDC fields ---
  clientId: varchar("clientId", { length: 255 }),
  clientSecret: text("clientSecret"),
  discoveryUrl: varchar("discoveryUrl", { length: 2048 }),
  // Comma-separated; defaults to "openid,email,profile" when null.
  scopes: varchar("scopes", { length: 512 }),
  // Optional email domain this connection serves (display + future routing).
  domain: varchar("domain", { length: 255 }),
  createdBy: uuid("createdBy").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt"),
}).enableRLS();
