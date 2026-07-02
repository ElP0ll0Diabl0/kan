# Admin Integrations

The **Admin → Integrations** area lets a self-hosted instance's superadmins
configure integrations from the UI instead of environment variables / the
deploy shell. It lives under `/admin/integrations` and is gated to superadmins
on self-hosted deployments only (`NEXT_PUBLIC_KAN_ENV !== "cloud"`).

Sub-tabs: **Microsoft Teams** (done), **SSO** (OIDC done, SAML planned),
**SCIM** (planned).

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Integrations shell + DB-backed **Teams bot** config | ✅ Deployed |
| 2 | **OIDC SSO** connections (runtime, no redeploy) | ✅ Deployed |
| 3 | **SAML 2.0** SSO | ⏳ Planned |
| 4 | **SCIM** provisioning | ⏳ Planned |
| 5 | **Actionable Adaptive Cards** (Teams) | ⏳ Planned |

## Design principles

- **Instance-level scope.** Connections are configured once per instance (not
  per-workspace). The `type` discriminator and nullable columns leave room to
  extend later without reshaping the schema.
- **DB-backed with env fallback.** A DB row overrides the corresponding env
  configuration; with **no row**, behaviour is identical to the env-only setup
  that predated the UI. This is why deploying a phase can't disrupt a running
  env-configured integration until an admin explicitly saves config.
- **Runtime pickup where possible.** Changes take effect without a redeploy
  (Teams: adapter cache keyed on config; SSO: auth handler rebuilds on change).
- **Secrets encrypted at rest.** Client secrets / bot passwords are stored
  AES-256-GCM encrypted (`packages/api/src/utils/encryption.ts`, keyed on
  `BETTER_AUTH_SECRET`). Secrets are **never returned** by read APIs — the UI
  shows only whether a secret is set.
- **Superadmin + self-hosted gated.** All admin procedures use
  `superAdminProcedure`; the area is hidden on cloud.

## Phase 1 — Teams bot config (deployed)

Moves the Teams bot credentials out of `MICROSOFT_BOT_*` env vars into a DB row
manageable from the UI, and shows linked users.

- **Schema:** `bot_config` (single instance row: `appId`, encrypted
  `appPassword`, `tenantId`, `enabled`) — `packages/db/src/schema/botConfig.ts`.
- **Resolver:** `resolveBotConfig(db)` in
  `packages/api/src/utils/teamsConfig.ts` — DB row → env fallback. An
  `enabled=false` row is an explicit off-switch that overrides env.
- **Runtime pickup:** `@kan/teams` takes the resolved config by parameter;
  `getAdapter(config)` caches keyed on the config, so a UI credential change
  rebuilds the adapter without a restart. Threaded through
  `api/teams/messages`, the notification dispatcher's Teams branch, and
  `integration.getTeamsStatus`.
- **Admin procedures:** `admin.getTeamsConfig` / `updateTeamsConfig` /
  `listTeamsConnections`.
- **UI:** `views/admin/integrations/TeamsIntegrationPanel.tsx` (credential form,
  enable toggle, source/status, connected-users panel).

## Phase 2 — OIDC SSO (deployed)

Superadmins add OIDC identity providers (Entra, Okta, Auth0, …) that take
effect at runtime.

- **Schema:** `sso_connection` (`type` discriminator, `providerId` slug,
  `name`, `enabled`, `clientId`, encrypted `clientSecret`, `discoveryUrl`,
  `scopes`, optional `domain`) — `packages/db/src/schema/ssoConnections.ts`.
- **Auth wiring:** `createPlugins(db, ssoConnections)` builds the
  `genericOAuth` config from the env OIDC provider **plus** each DB connection,
  sharing one OIDC→user mapper (captures `oid` for Teams auto-linking).
  `initAuth(db, { ssoConnections })` (`packages/auth/src/{auth,plugins}.ts`).
- **Runtime pickup (the key mechanism):** `apps/web/src/pages/api/auth/[...all].ts`
  builds the better-auth handler on demand and **rebuilds it only when the
  enabled-connection set changes** (30 s TTL; ~1 extra DB query per window).
  It is **resilient** — if the SSO lookup fails it reuses the last handler, so
  email/social/magic-link sign-in can never be taken down by a bad SSO row.
  `resolveSsoConnections(db)` (`packages/api/src/utils/ssoConfig.ts`) reads and
  decrypts enabled connections.
- **API:** `sso` router (`packages/api/src/routers/sso.ts`) — superadmin
  `list/create/update/delete` (secret never returned; `providerId` is a
  validated slug, **immutable after create**, and each connection surfaces its
  IdP callback URL `…/api/auth/oauth2/callback/{providerId}`) + public
  `listForLogin`.
- **UI:** `views/admin/integrations/SsoIntegrationPanel.tsx` (connection list,
  add/edit form, callback-URL display) and login buttons in
  `components/AuthForm.tsx` (`signIn.oauth2` per enabled connection).

**Operator flow:** Add connection → copy its callback URL → register it as the
redirect URI at the IdP → enable → within ~30 s the login page shows
"Continue with {name}".

## Planned phases

- **Phase 3 — SAML 2.0.** better-auth has no native SAML SP, so this needs an
  external library (e.g. `@node-saml`) and a custom SP plugin; security review
  warranted. The `sso_connection.type` discriminator already anticipates it.
- **Phase 4 — SCIM.** No better-auth support; requires custom
  `/api/scim/v2/{Users,Groups}` endpoints with bearer auth, mapping to the
  existing user + workspace-membership schema.
- **Phase 5 — Actionable Adaptive Cards.** Interactive Teams cards
  (`Action.Execute`) require bot SSO and an `invoke` activity handler on the bot
  endpoint, plus per-event action config. Surfaced as "coming soon" in the
  Teams tab today.

## Migrations

Additive, one per phase. On the production DB the drizzle ledger row count
tracks applied migrations:

| Migration | Adds | Ledger |
| --- | --- | --- |
| `AddTeamsSchema` | `teams_conversation`, `user.entraObjectId`, `notification_rule.teamsEnabled` | 41 |
| `AddBotConfig` | `bot_config` | 42 |
| `AddSsoConnection` | `sso_connection` | 43 |

Generate new migrations with `pnpm --filter @kan/db exec drizzle-kit generate
--name <Name>` after editing the schema; inspect the SQL before committing.

## Deploy notes (self-hosted / VPS)

- **Live stack** runs from `/docker/kan-yzwq` (compose project `kan-yzwq`),
  using locally-built image tags `kan:custom` / `kan-migrate:custom` (no
  `build:` context in that compose; explicit `environment:` block, no
  `env_file`). DB container: `kan-yzwq-postgres-1`. Source clone: `/root/dev/kan`.
- **Build from source; never `docker compose pull`** — the upstream `kanbn`
  images don't contain this fork's code or migrations.
- A code change needs a **web** rebuild; a new migration also needs a
  **migrate** rebuild:
  ```bash
  cd /root/dev/kan && git checkout main && git pull
  docker tag "$(docker images -q kan:custom)" kan:rollback-<label>   # pin rollback
  docker build -f apps/web/Dockerfile --target web     -t kan:custom .
  docker build -f apps/web/Dockerfile --target migrate -t kan-migrate:custom .  # if migration changed
  cd /docker/kan-yzwq && docker compose up -d
  ```
- **Rollback** (image tags are additive-migration safe — old code ignores new
  tables/columns):
  ```bash
  cd /docker/kan-yzwq && docker tag kan:rollback-<label> kan:custom && docker compose up -d kan
  ```

## Operational notes

- SSO changes touch the **auth hot path** — prefer a low-traffic deploy window
  and keep the rollback tag handy. The resilient fallback means a bad SSO row
  degrades to "no SSO buttons," not "login down."
- Microsoft sign-in (env) uses the `/common` authority
  (`packages/auth/src/providers.ts` hardcodes `tenantId: "common"`), so its
  Entra app must be **multi-tenant**; restrict to your org with
  `BETTER_AUTH_ALLOWED_DOMAINS`. `trustedProviders: ["microsoft"]` is set
  because Entra sends no `email_verified` claim (otherwise account linking to
  existing same-email users fails).
