import type { dbClient } from "@kan/db/client";
import type { BotConfig } from "@kan/teams";
import * as botConfigRepo from "@kan/db/repository/botConfig.repo";
import { getBotConfig } from "@kan/teams";

import { decryptToken } from "./encryption";

export interface ResolvedBotConfig extends BotConfig {
  /** Whether the bot is configured AND turned on. */
  enabled: boolean;
  /** Where the effective config came from. */
  source: "db" | "env" | "none";
}

/**
 * Resolves the effective Teams bot configuration: a DB-backed instance config
 * row (set via the admin UI) takes precedence; otherwise it falls back to the
 * MICROSOFT_BOT_* environment variables — so a deployment with no DB row behaves
 * exactly as it did before the admin UI existed.
 */
export const resolveBotConfig = async (
  db: dbClient,
): Promise<ResolvedBotConfig> => {
  const row = await botConfigRepo.getConfig(db);

  if (row) {
    // An explicit DB row acts as the authoritative on/off switch: a disabled row
    // turns the bot off even when env credentials are present.
    if (!row.enabled) {
      return {
        appId: "",
        appPassword: "",
        tenantId: undefined,
        enabled: false,
        source: "db",
      };
    }

    if (row.appId && row.appPassword) {
      let appPassword = "";
      try {
        appPassword = decryptToken(row.appPassword);
      } catch {
        // Stored secret is unreadable (e.g. BETTER_AUTH_SECRET rotated); treat
        // the DB config as unusable and fall through to the env fallback below.
        appPassword = "";
      }

      if (appPassword) {
        return {
          appId: row.appId,
          appPassword,
          tenantId: row.tenantId ?? undefined,
          enabled: true,
          source: "db",
        };
      }
    }
    // Row is enabled but has no usable credentials → fall back to env below.
  }

  const env = getBotConfig();
  const configured = !!env.appId && !!env.appPassword;
  return {
    appId: env.appId,
    appPassword: env.appPassword,
    tenantId: env.tenantId,
    enabled: configured,
    source: configured ? "env" : "none",
  };
};
