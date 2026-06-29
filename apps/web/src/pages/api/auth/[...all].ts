import type { NextApiRequest, NextApiResponse } from "next";
import { toNodeHandler } from "better-auth/node";

import { withRateLimit } from "@kan/api/utils/rateLimit";
import { resolveSsoConnections } from "@kan/api/utils/ssoConfig";
import { initAuth } from "@kan/auth/server";
import { createDrizzleClient } from "@kan/db/client";

export const config = { api: { bodyParser: false } };

// Reuse a single db client (pool) across requests.
const db = createDrizzleClient();

type AuthHandler = ReturnType<typeof toNodeHandler>;
type SsoConnections = Awaited<ReturnType<typeof resolveSsoConnections>>;

// The better-auth instance bakes its OIDC provider list in at construction, so
// to pick up admin-configured SSO connections without a redeploy we rebuild it
// when the enabled-connection set changes. A short TTL means at most one extra
// DB query per window on the auth path; the handler is only rebuilt when the
// connections actually change (keyed below).
const TTL_MS = 30_000;
let cache: { handler: AuthHandler; key: string; fetchedAt: number } | null =
  null;

const buildHandler = (ssoConnections: SsoConnections): AuthHandler =>
  toNodeHandler(initAuth(db, { ssoConnections }).handler);

const getAuthHandler = async (now: number): Promise<AuthHandler> => {
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.handler;

  let ssoConnections: SsoConnections;
  try {
    ssoConnections = await resolveSsoConnections(db);
  } catch {
    // Never let an SSO lookup failure break sign-in: reuse the last handler, or
    // build one with no SSO connections (email/social/magic-link still work).
    if (cache) return cache.handler;
    return buildHandler([]);
  }

  const key = JSON.stringify(ssoConnections);
  if (cache && cache.key === key) {
    cache.fetchedAt = now;
    return cache.handler;
  }

  const handler = buildHandler(ssoConnections);
  cache = { handler, key, fetchedAt: now };
  return handler;
};

export default withRateLimit(
  { points: 100, duration: 60 },
  async (req: NextApiRequest, res: NextApiResponse) => {
    /**
     * Better-auth behind proxies (Nginx/Cloudflare) can sometimes fail to parse the protocol
     * if headers are incorrectly set or if there are multiple values in X-Forwarded-Proto.
     * We sanitize these headers here to ensure better-auth gets a clean protocol and host.
     */
    const forwardedProto = req.headers["x-forwarded-proto"];
    if (forwardedProto) {
      const p = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto;
      req.headers["x-forwarded-proto"] = p?.split(",")[0]?.trim();
    }

    const forwardedHost = req.headers["x-forwarded-host"];
    if (forwardedHost) {
      const h = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
      req.headers["host"] = h?.split(",")[0]?.trim();
    }

    const authHandler = await getAuthHandler(Date.now());
    return await authHandler(req, res);
  },
);
