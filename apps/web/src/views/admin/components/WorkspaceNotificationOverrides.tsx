import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useState } from "react";

import LoadingSpinner from "~/components/LoadingSpinner";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import type { NotificationEventType } from "./notificationEvents";
import {
  NOTIFICATION_EVENT_GROUPS,
  NOTIFICATION_EVENTS,
} from "./notificationEvents";

export function WorkspaceNotificationOverrides({
  workspacePublicId,
}: {
  workspacePublicId: string;
}) {
  const { i18n } = useLingui();
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const { data, isLoading } = api.admin.getWorkspaceNotificationRules.useQuery(
    { workspacePublicId },
    { enabled: !!workspacePublicId },
  );

  const [subjects, setSubjects] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    setSubjects(
      Object.fromEntries(
        data.map((rule) => [rule.eventType, rule.override?.customSubject ?? ""]),
      ),
    );
  }, [data]);

  const invalidate = async () => {
    await utils.admin.getWorkspaceNotificationRules.invalidate({
      workspacePublicId,
    });
  };

  const onError = (error: { message: string }) => {
    showPopup({
      header: t`Unable to update notification`,
      message: error.message,
      icon: "error",
    });
  };

  const upsert = api.admin.upsertWorkspaceNotificationRule.useMutation({
    onSuccess: invalidate,
    onError,
  });
  const remove = api.admin.deleteWorkspaceNotificationRule.useMutation({
    onSuccess: invalidate,
    onError,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-24 w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const byEvent = new Map(data.map((rule) => [rule.eventType, rule]));

  const onSelect = (eventType: NotificationEventType, value: string) => {
    if (value === "inherit") {
      remove.mutate({ workspacePublicId, eventType });
      return;
    }
    const draft = subjects[eventType]?.trim();
    upsert.mutate({
      workspacePublicId,
      eventType,
      enabled: value === "enabled",
      customSubject: draft ? draft : null,
    });
  };

  const saveSubject = (eventType: NotificationEventType) => {
    const override = byEvent.get(eventType)?.override;
    if (!override) return; // No override row to attach the subject to.
    const draft = subjects[eventType]?.trim() ?? "";
    if (draft === (override.customSubject ?? "")) return;
    upsert.mutate({
      workspacePublicId,
      eventType,
      enabled: override.enabled,
      customSubject: draft ? draft : null,
    });
  };

  return (
    <div className="space-y-6">
      {NOTIFICATION_EVENT_GROUPS.map((group) => (
        <div key={group.key}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-light-900 dark:text-dark-900">
            {i18n._(group.label)}
          </h3>
          <div className="overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5">
            <ul className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
              {NOTIFICATION_EVENTS.filter(
                (meta) => meta.group === group.key,
              ).map((meta) => {
                const rule = byEvent.get(meta.eventType);
                const override = rule?.override ?? null;
                const value = !override
                  ? "inherit"
                  : override.enabled
                    ? "enabled"
                    : "disabled";
                const globalLabel = rule?.global.enabled
                  ? t`Global: On`
                  : t`Global: Off`;
                return (
                  <li
                    key={meta.eventType}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
                        {i18n._(meta.label)}
                      </p>
                      <p className="text-xs text-light-900 dark:text-dark-900">
                        {globalLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
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
                        disabled={value !== "enabled"}
                        placeholder={t`Default subject`}
                        className="w-full rounded-lg border-0 bg-light-50 py-2 px-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 disabled:opacity-50 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500 sm:w-56"
                      />
                      <select
                        value={value}
                        onChange={(e) =>
                          onSelect(meta.eventType, e.target.value)
                        }
                        className="rounded-lg border-0 bg-light-50 py-2 pl-3 pr-8 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500"
                      >
                        <option value="inherit">{t`Use global`}</option>
                        <option value="enabled">{t`Enabled`}</option>
                        <option value="disabled">{t`Disabled`}</option>
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
