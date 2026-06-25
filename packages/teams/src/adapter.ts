import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} from "botbuilder";

import { createLogger } from "@kan/logger";

import { getBotConfig } from "./config";

const log = createLogger("teams");

let adapter: CloudAdapter | null = null;

/**
 * Lazily-constructed singleton CloudAdapter. The adapter validates the inbound
 * Bot Framework JWT itself and is also used for proactive (outbound) sends.
 */
export const getAdapter = (): CloudAdapter => {
  if (adapter) return adapter;

  const { appId, appPassword, tenantId } = getBotConfig();

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

  adapter = created;
  return created;
};
