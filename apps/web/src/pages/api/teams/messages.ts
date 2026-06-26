import type { NextApiRequest, NextApiResponse } from "next";

import { createDrizzleClient } from "@kan/db/client";
import * as teamsConversationRepo from "@kan/db/repository/teamsConversation.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import { isTeamsEnabled, processBotRequest } from "@kan/teams";

// Bot Framework authenticates via the Authorization header (a signed JWT), not
// a body signature, so Next's default body parsing is safe — and required:
// botbuilder's CloudAdapter.process() reads `req.body` as an already-parsed
// object and returns 400 otherwise. Do NOT set `bodyParser: false` here.

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  if (!isTeamsEnabled()) {
    return res.status(404).end();
  }

  const db = createDrizzleClient();

  await processBotRequest(req, res, async (info) => {
    // Auto-link: match the Teams identity's Entra object id to a Kan user.
    if (!info.aadObjectId) return { linked: false };

    const user = await userRepo.getByEntraObjectId(db, info.aadObjectId);
    if (!user) return { linked: false };

    await teamsConversationRepo.upsertByUserId(db, {
      userId: user.id,
      aadObjectId: info.aadObjectId,
      tenantId: info.tenantId,
      serviceUrl: info.serviceUrl,
      conversationReference: info.conversationReference,
    });

    return { linked: true, displayName: user.name ?? undefined };
  });
}
