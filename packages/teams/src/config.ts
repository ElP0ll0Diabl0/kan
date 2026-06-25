export const getBotConfig = () => ({
  appId: process.env.MICROSOFT_BOT_ID ?? "",
  appPassword: process.env.MICROSOFT_BOT_PASSWORD ?? "",
  // Optional: set for a single-tenant bot; omit for multi-tenant.
  tenantId: process.env.MICROSOFT_BOT_TENANT_ID,
});

/** Whether the Teams bot is configured for this deployment. */
export const isTeamsEnabled = (): boolean =>
  !!process.env.MICROSOFT_BOT_ID && !!process.env.MICROSOFT_BOT_PASSWORD;
