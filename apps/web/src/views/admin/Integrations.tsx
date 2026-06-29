import { t } from "@lingui/core/macro";
import { useState } from "react";

import { PageHead } from "~/components/PageHead";
import { SsoIntegrationPanel } from "./integrations/SsoIntegrationPanel";
import { TeamsIntegrationPanel } from "./integrations/TeamsIntegrationPanel";

type IntegrationTab = "teams" | "sso" | "scim";

const TABS: { key: IntegrationTab; label: string }[] = [
  { key: "teams", label: "Microsoft Teams" },
  { key: "sso", label: "SSO" },
  { key: "scim", label: "SCIM" },
];

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-light-600 bg-light-50 p-8 text-center dark:border-dark-600 dark:bg-dark-100">
      <p className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs text-light-900 dark:text-dark-900">
        {description}
      </p>
      <span className="mt-3 inline-flex items-center rounded-full bg-light-200 px-2.5 py-0.5 text-xs font-medium text-light-1000 dark:bg-dark-200 dark:text-dark-1000">
        {t`Coming soon`}
      </span>
    </div>
  );
}

export function Integrations() {
  const [tab, setTab] = useState<IntegrationTab>("teams");

  return (
    <>
      <PageHead title={t`Admin | Integrations`} />

      <div className="mb-6">
        <p className="text-sm text-light-900 dark:text-dark-900">
          {t`Configure instance-level integrations here, so connections can be managed from the UI rather than environment variables.`}
        </p>
      </div>

      {/* Secondary (sub-)tab bar */}
      <div className="mb-6 inline-flex rounded-lg bg-light-200 p-1 dark:bg-dark-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
              tab === item.key
                ? "bg-light-50 text-light-1000 shadow-sm dark:bg-dark-50 dark:text-dark-1000"
                : "text-light-900 hover:text-light-1000 dark:text-dark-900 dark:hover:text-dark-1000"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "teams" && <TeamsIntegrationPanel />}
      {tab === "sso" && <SsoIntegrationPanel />}
      {tab === "scim" && (
        <ComingSoon
          title={t`SCIM provisioning`}
          description={t`Automatic user and group provisioning from your identity provider will be configurable here.`}
        />
      )}
    </>
  );
}
