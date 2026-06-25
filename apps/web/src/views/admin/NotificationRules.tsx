import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HiOutlinePencilSquare } from "react-icons/hi2";

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

  // The inline controls (toggle + subject) edit only those two fields, so
  // explicitly pass through the existing customBody to avoid wiping admin-
  // authored bodies on every toggle / blur. The upsertRule repo write is a
  // full-row update, not a partial patch.
  const toggle = (eventType: NotificationEventType, enabled: boolean) => {
    const subject = subjects[eventType]?.trim();
    const existing = byEvent.get(eventType);
    upsert.mutate({
      eventType,
      enabled,
      customSubject: subject ? subject : null,
      customBody: existing?.customBody ?? null,
    });
  };

  const saveSubject = (eventType: NotificationEventType, enabled: boolean) => {
    const draft = subjects[eventType]?.trim() ?? "";
    const existing = byEvent.get(eventType);
    const original = existing?.customSubject ?? "";
    if (draft === original) return;
    upsert.mutate({
      eventType,
      enabled,
      customSubject: draft ? draft : null,
      customBody: existing?.customBody ?? null,
    });
  };

  return (
    <>
      <PageHead title={t`Admin | Notifications`} />

      <div className="mb-6">
        <p className="text-sm text-light-900 dark:text-dark-900">
          {t`Enable or disable email notifications for each event, and optionally override the subject line. These are the global defaults; individual workspaces can override them from the workspace's page.`}
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
                          onBlur={() => saveSubject(meta.eventType, enabled)}
                          disabled={!enabled}
                          placeholder={t`Default subject`}
                          className="w-full rounded-lg border-0 bg-light-50 py-2 px-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 disabled:opacity-50 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500 sm:w-64"
                        />
                        <Link
                          href={`/admin/notifications/${meta.eventType}`}
                          aria-label={t`Edit ${i18n._(meta.label)}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-light-900 hover:bg-light-200 hover:text-light-1000 dark:text-dark-900 dark:hover:bg-dark-200 dark:hover:text-dark-1000"
                        >
                          <HiOutlinePencilSquare />
                        </Link>
                        <Toggle
                          isChecked={enabled}
                          onChange={() => toggle(meta.eventType, !enabled)}
                          label={i18n._(meta.label)}
                          showLabel={false}
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
