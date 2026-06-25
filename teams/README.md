# Kan — Microsoft Teams bot

Phase 1 delivers **read-only notifications**: a user receives their enabled Kan
notifications as Adaptive Cards in a 1:1 chat with the Kan bot in Microsoft
Teams. Everything runs on your existing Kan deployment — Microsoft only hosts a
free message relay (the Bot Connector).

## How linking works

There is **no manual connect step**. The bot matches the Teams user's Entra
directory object id (`oid`) to the Kan user's `entraObjectId`, which Kan captures
when the user signs in with Microsoft / Entra ID. So a user must:

1. Sign in to Kan with their **Microsoft account** (so Kan stores their `oid`), then
2. Add the **Kan** app in Teams and **send the bot any message**.

The bot then stores their conversation reference and pushes notifications there.
Notifications are gated per-event in **Admin → Notifications** (and per workspace),
where each event has independent **Email** and **Teams** toggles.

## One-time setup (operator)

Requires an Azure subscription (pay-as-you-go; the bot runs on the free **F0**
tier and the Teams channel is free — realistic cost **$0**). No Azure compute.

1. **Entra app for the bot** — in the Entra admin center, register an app; create
   a **client secret**. Note the **Application (client) ID** and the secret value.
2. **Azure Bot resource** — create an *Azure Bot* (F0). Set its **Microsoft App ID**
   to the app from step 1. Set the **messaging endpoint** to:
   `https://<your-kan-domain>/api/teams/messages`
   Then under *Channels*, add **Microsoft Teams**.
3. **Env vars** (see `.env.example`):
   - `MICROSOFT_BOT_ID` = the bot's Application (client) ID
   - `MICROSOFT_BOT_PASSWORD` = the client secret value
   - `MICROSOFT_BOT_TENANT_ID` = your tenant id (omit for a multi-tenant bot)
   - Ensure **Microsoft sign-in** is configured for Kan (`MICROSOFT_CLIENT_ID/_SECRET`
     or the `OIDC_*` vars pointed at your tenant) so `entraObjectId` is captured.
4. **Teams app package** — in `teams/manifest/`, replace the `${{MICROSOFT_BOT_ID}}`
   and `${{KAN_DOMAIN}}` placeholders, add `color.png` (192×192) and
   `outline.png` (32×32, transparent), then zip the three files. Upload via Teams
   admin center (or sideload for testing).

## Local development

The messaging endpoint must be reachable over HTTPS. Use a dev tunnel
(`devtunnel` or `ngrok`) pointing at your local Kan, and set the Azure Bot's
messaging endpoint to `https://<tunnel>/api/teams/messages` while testing.

## Disabling

Leave `MICROSOFT_BOT_ID` / `MICROSOFT_BOT_PASSWORD` unset and the whole feature is
inert: `/api/teams/messages` returns 404, the dispatcher's Teams branch is
skipped, and the Settings → Integrations Teams card is hidden.
