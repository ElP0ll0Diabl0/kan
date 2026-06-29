import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} from "botbuilder";

import { createLogger } from "@kan/logger";

import type { BotConfig } from "./config";

const log = createLogger("teams");

// The adapter is expensive to build, so it is cached and reused. The cache is
// keyed on the resolved config so that a runtime config change (e.g. an admin
// updating the bot credentials in the DB) transparently rebuilds the adapter on
// the next request — no restart needed.
let cached: { key: string; adapter: CloudAdapter } | null = null;

const configKey = (config: BotConfig): string =>
  `${config.appId}|${config.tenantId ?? ""}|${config.appPassword}`;

/**
 * Returns a CloudAdapter for the given bot config. The adapter validates the
 * inbound Bot Framework JWT itself and is also used for proactive (outbound)
 * sends. Cached per distinct config.
 */
export const getAdapter = (config: BotConfig): CloudAdapter => {
  const key = configKey(config);
  if (cached && cached.key === key) return cached.adapter;

  const { appId, appPassword, tenantId } = config;

  const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: appId,
    MicrosoftAppPassword: appPassword,
    MicrosoftAppType: tenantId ? "SingleTenant" : "MultiTenant",
    MicrosoftAppTenantId: tenantId,
  });

  // The first arg is a config provider; we supply credentials explicitly via
  // the factory, so a no-op config is sufficient.
  const auth = createBotFrameworkAuthenticationFromConfiguration(
    { get: () => undefined } as never,
    credentialsFactory,
  );

  const created = new CloudAdapter(auth);
  created.onTurnError = async (_context, error) => {
    log.error({ err: error }, "Teams bot turn error");
  };

  cached = { key, adapter: created };
  return created;
};
