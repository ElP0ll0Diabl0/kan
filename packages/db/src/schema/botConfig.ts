import { bigserial, boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./users";

// Instance-level Microsoft Teams bot configuration (a single row). When a row
// exists with credentials, it overrides the MICROSOFT_BOT_* environment vars —
// letting an admin configure the bot from the UI instead of the deploy env.
// With no row, resolution falls back to the env vars (identical to the original
// behaviour). The app password is stored AES-256-GCM encrypted.
export const botConfig = pgTable("bot_config", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  appId: varchar("appId", { length: 255 }),
  // Encrypted via the shared token encryption util (see @kan/api encryption).
  appPassword: text("appPassword"),
  tenantId: varchar("tenantId", { length: 255 }),
  enabled: boolean("enabled").notNull().default(false),
  updatedBy: uuid("updatedBy").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt"),
}).enableRLS();
