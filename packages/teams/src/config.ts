export interface BotConfig {
  appId: string;
  appPassword: string;
  // Optional: set for a single-tenant bot; omit for multi-tenant.
  tenantId?: string;
}

/**
 * Bot credentials from environment variables. This is the fallback used when no
 * instance-level config row exists in the database (see resolveBotConfig in
 * @kan/api), preserving the original env-only behaviour.
 */
export const getBotConfig = (): BotConfig => ({
  appId: process.env.MICROSOFT_BOT_ID ?? "",
  appPassword: process.env.MICROSOFT_BOT_PASSWORD ?? "",
  tenantId: process.env.MICROSOFT_BOT_TENANT_ID,
});

/** Whether the Teams bot is configured via environment variables. */
export const isTeamsEnabled = (): boolean =>
  !!process.env.MICROSOFT_BOT_ID && !!process.env.MICROSOFT_BOT_PASSWORD;
