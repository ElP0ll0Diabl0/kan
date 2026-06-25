import { t } from "@lingui/core/macro";

import { PageHead } from "~/components/PageHead";
import { api } from "~/utils/api";

export function Overview() {
  const { data, isLoading } = api.admin.getStats.useQuery();

  const stats = [
    { label: t`Workspaces`, value: data?.workspaces },
    { label: t`Users`, value: data?.users },
    { label: t`Boards`, value: data?.boards },
    { label: t`Cards`, value: data?.cards },
  ];

  return (
    <>
      <PageHead title={t`Admin | Overview`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-light-300 bg-light-50 p-5 dark:border-dark-300 dark:bg-dark-50"
          >
            <p className="text-sm text-light-900 dark:text-dark-900">
              {stat.label}
            </p>
            {isLoading ? (
              <div className="mt-2 h-7 w-16 animate-pulse rounded bg-light-200 dark:bg-dark-200" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-dark-1000">
                {stat.value?.toLocaleString() ?? "—"}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
