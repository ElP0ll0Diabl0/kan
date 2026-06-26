import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";

import Button from "~/components/Button";
import Input from "~/components/Input";
import LoadingSpinner from "~/components/LoadingSpinner";
import Toggle from "~/components/Toggle";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

export function TeamsIntegrationPanel() {
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const sourceLabel: Record<"db" | "env" | "none", string> = {
    db: t`Configured in the database (managed here).`,
    env: t`Configured via environment variables.`,
    none: t`Not configured.`,
  };

  const { data: config, isLoading } = api.admin.getTeamsConfig.useQuery();
  const { data: connections } = api.admin.listTeamsConnections.useQuery();

  const [appId, setAppId] = useState("");
  const [secret, setSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [enabled, setEnabled] = useState(false);

  // Seed the form from the resolved config once it loads. The secret is never
  // returned by the API, so it always starts blank ("leave empty to keep").
  useEffect(() => {
    if (!config) return;
    setAppId(config.appId);
    setTenantId(config.tenantId ?? "");
    setEnabled(config.enabled);
  }, [config]);

  const update = api.admin.updateTeamsConfig.useMutation({
    onSuccess: async () => {
      setSecret("");
      await Promise.all([
        utils.admin.getTeamsConfig.invalidate(),
        utils.integration.getTeamsStatus.invalidate(),
      ]);
      showPopup({
        header: t`Teams settings saved`,
        message: t`The bot configuration has been updated.`,
        icon: "success",
      });
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to save Teams settings`,
        message: error.message,
        icon: "error",
      });
    },
  });

  if (isLoading || !config) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const onSave = () => {
    update.mutate({
      appId: appId.trim(),
      // Only send the secret when the admin entered a new one.
      appPassword: secret ? secret : undefined,
      tenantId: tenantId.trim() ? tenantId.trim() : undefined,
      enabled,
    });
  };

  return (
    <div className="space-y-8">
      {/* Status + bot config form */}
      <section className="rounded-lg bg-light-50 p-6 shadow ring-1 ring-black ring-opacity-5 dark:bg-dark-100">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-dark-1000">
              {t`Bot credentials`}
            </h2>
            <p className="mt-1 text-xs text-light-900 dark:text-dark-900">
              {sourceLabel[config.source]}{" "}
              {config.source === "env"
                ? t`Enter credentials below to manage the bot from here instead.`
                : ""}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              config.enabled
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : "bg-light-200 text-light-1000 dark:bg-dark-200 dark:text-dark-1000"
            }`}
          >
            {config.enabled ? t`Active` : t`Inactive`}
          </span>
        </div>

        <div className="grid gap-4 sm:max-w-lg">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-900 dark:text-dark-1000">
              {t`Application (client) ID`}
            </span>
            <Input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-900 dark:text-dark-1000">
              {t`Client secret`}
            </span>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={
                config.hasStoredPassword
                  ? t`•••••••• (leave empty to keep current)`
                  : t`Enter the bot's client secret`
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-900 dark:text-dark-1000">
              {t`Directory (tenant) ID`}{" "}
              <span className="font-normal text-light-900 dark:text-dark-900">
                {t`— optional, for single-tenant bots`}
              </span>
            </span>
            <Input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </label>

          <div className="flex items-center justify-between border-t border-light-600 pt-4 dark:border-dark-600">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
                {t`Enable Teams notifications`}
              </p>
              <p className="text-xs text-light-900 dark:text-dark-900">
                {t`When off, no Teams cards are sent and the bot endpoint returns 404.`}
              </p>
            </div>
            <Toggle
              isChecked={enabled}
              onChange={() => setEnabled((v) => !v)}
              label={t`Enable Teams notifications`}
              showLabel={false}
            />
          </div>

          <div>
            <Button onClick={onSave} isLoading={update.isPending}>
              {t`Save changes`}
            </Button>
          </div>
        </div>
      </section>

      {/* Actionable cards — placeholder for the next phase */}
      <section className="rounded-lg border border-dashed border-light-600 bg-light-50 p-6 dark:border-dark-600 dark:bg-dark-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-dark-1000">
              {t`Actionable adaptive cards`}
            </h2>
            <p className="mt-1 max-w-md text-xs text-light-900 dark:text-dark-900">
              {t`Let users act on notifications directly from the Teams card (e.g. assign, comment, move). Requires bot SSO and an invoke handler.`}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-light-200 px-2.5 py-0.5 text-xs font-medium text-light-1000 dark:bg-dark-200 dark:text-dark-1000">
            {t`Coming soon`}
          </span>
        </div>
      </section>

      {/* Connected users */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-dark-1000">
          {t`Connected users`}{" "}
          <span className="font-normal text-light-900 dark:text-dark-900">
            ({connections?.length ?? 0})
          </span>
        </h2>
        {connections && connections.length > 0 ? (
          <div className="overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5">
            <table className="min-w-full divide-y divide-light-600 dark:divide-dark-600">
              <thead className="bg-light-100 dark:bg-dark-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-light-900 dark:text-dark-900">
                    {t`User`}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-light-900 dark:text-dark-900">
                    {t`Connected`}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
                {connections.map((c) => (
                  <tr key={c.publicId}>
                    <td className="px-4 py-2 text-sm text-neutral-900 dark:text-dark-1000">
                      <div className="font-medium">{c.name ?? c.email}</div>
                      {c.name && (
                        <div className="text-xs text-light-900 dark:text-dark-900">
                          {c.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-light-900 dark:text-dark-900">
                      {new Date(c.connectedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-light-900 dark:text-dark-900">
            {t`No users have linked the Teams bot yet. Users connect by signing in with Microsoft, then messaging the Kan bot in Teams.`}
          </p>
        )}
      </section>
    </div>
  );
}
