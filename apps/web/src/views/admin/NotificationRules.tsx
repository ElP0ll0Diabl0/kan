import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useState } from "react";

import LoadingSpinner from "~/components/LoadingSpinner";
import { PageHead } from "~/components/PageHead";
import Toggle from "~/components/Toggle";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import type { NotificationEventType } from "./components/notificationEvents";
import {
  NOTIFICATION_EVENT_GROUPS,
  NOTIFICATION_EVENTS,
} from "./components/notificationEvents";

export function NotificationRules() {
  const { i18n } = useLingui();
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const { data, isLoading } = api.admin.listGlobalNotificationRules.useQuery();

  // Local drafts for the subject inputs, seeded from the query.
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    setSubjects(
      Object.fromEntries(
        data.map((rule) => [rule.eventType, rule.customSubject ?? ""]),
      ),
    );
  }, [data]);

  const upsert = api.admin.upsertGlobalNotificationRule.useMutation({
    onSuccess: async () => {
      await utils.admin.listGlobalNotificationRules.invalidate();
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to update notification`,
        message: error.message,
        icon: "error",
      });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const byEvent = new Map(data.map((rule) => [rule.eventType, rule]));

  const save = (
    eventType: NotificationEventType,
    patch: { enabled?: boolean; teamsEnabled?: boolean; customSubject?: string | null },
  ) => {
    const rule = byEvent.get(eventType);
    const draft = subjects[eventType]?.trim();
    upsert.mutate({
      eventType,
      enabled: patch.enabled ?? rule?.enabled ?? false,
      teamsEnabled: patch.teamsEnabled ?? rule?.teamsEnabled ?? false,
      customSubject:
        patch.customSubject !== undefined
          ? patch.customSubject
          : draft
            ? draft
            : null,
    });
  };

  const saveSubject = (eventType: NotificationEventType) => {
    const draft = subjects[eventType]?.trim() ?? "";
    const original = byEvent.get(eventType)?.customSubject ?? "";
    if (draft === original) return;
    save(eventType, { customSubject: draft ? draft : null });
  };

  return (
    <>
      <PageHead title={t`Admin | Notifications`} />

      <div className="mb-6">
        <p className="text-sm text-light-900 dark:text-dark-900">
          {t`Enable email and/or Microsoft Teams notifications for each event, and optionally override the subject line. These are the global defaults; individual workspaces can override them from the workspace's page.`}
        </p>
      </div>

      <div className="space-y-8">
        {NOTIFICATION_EVENT_GROUPS.map((group) => (
          <div key={group.key}>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-dark-1000">
              {i18n._(group.label)}
            </h2>
            <div className="overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5">
              <ul className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
                {NOTIFICATION_EVENTS.filter(
                  (meta) => meta.group === group.key,
                ).map((meta) => {
                  const rule = byEvent.get(meta.eventType);
                  const enabled = rule?.enabled ?? false;
                  const teamsEnabled = rule?.teamsEnabled ?? false;
                  return (
                    <li
                      key={meta.eventType}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
                          {i18n._(meta.label)}
                        </p>
                        <p className="text-xs text-light-900 dark:text-dark-900">
                          {i18n._(meta.description)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          value={subjects[meta.eventType] ?? ""}
                          onChange={(e) =>
                            setSubjects((prev) => ({
                              ...prev,
                              [meta.eventType]: e.target.value,
                            }))
                          }
                          onBlur={() => saveSubject(meta.eventType)}
                          disabled={!enabled && !teamsEnabled}
                          placeholder={t`Default subject`}
                          className="w-full rounded-lg border-0 bg-light-50 py-2 px-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 disabled:opacity-50 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500 sm:w-56"
                        />
                        <Toggle
                          isChecked={enabled}
                          onChange={() =>
                            save(meta.eventType, { enabled: !enabled })
                          }
                          label={t`Email`}
                          labelPosition="after"
                        />
                        <Toggle
                          isChecked={teamsEnabled}
                          onChange={() =>
                            save(meta.eventType, { teamsEnabled: !teamsEnabled })
                          }
                          label={t`Teams`}
                          labelPosition="after"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
