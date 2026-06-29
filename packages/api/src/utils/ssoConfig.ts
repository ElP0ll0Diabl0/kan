import type { dbClient } from "@kan/db/client";
import type { SsoOidcConfig } from "@kan/auth/server";
import * as ssoConnectionRepo from "@kan/db/repository/ssoConnection.repo";

import { decryptToken } from "./encryption";

/**
 * Resolves all enabled OIDC SSO connections into the plaintext config shape the
 * auth layer expects, decrypting each client secret. Connections that are
 * incomplete or whose secret can't be decrypted (e.g. BETTER_AUTH_SECRET
 * rotated) are skipped rather than breaking the whole auth handler.
 */
export const resolveSsoConnections = async (
  db: dbClient,
): Promise<SsoOidcConfig[]> => {
  const rows = await ssoConnectionRepo.listEnabled(db);

  const configs: SsoOidcConfig[] = [];
  for (const row of rows) {
    if (row.type !== "oidc") continue;
    if (
      !row.providerId ||
      !row.clientId ||
      !row.clientSecret ||
      !row.discoveryUrl
    ) {
      continue;
    }

    let clientSecret: string;
    try {
      clientSecret = decryptToken(row.clientSecret);
    } catch {
      continue;
    }

    configs.push({
      providerId: row.providerId,
      clientId: row.clientId,
      clientSecret,
      discoveryUrl: row.discoveryUrl,
      scopes: row.scopes
        ? row.scopes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    });
  }

  return configs;
};
