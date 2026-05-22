import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";

import Avatar from "~/components/Avatar";
import { PageHead } from "~/components/PageHead";
import { useDebounce } from "~/hooks/useDebounce";
import { api } from "~/utils/api";
import { getAvatarUrl } from "~/utils/helpers";
import { AdminPagination } from "./components/AdminPagination";

const PAGE_SIZE = 25;

export function Members() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [debouncedSearch] = useDebounce(search, 300);

  const { data, isLoading } = api.admin.listUsers.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const users = data?.users ?? [];

  return (
    <>
      <PageHead title={t`Admin | Members`} />
      <div className="relative mb-4 max-w-sm">
        <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-900 dark:text-dark-900" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder={t`Search by name or email`}
          className="w-full rounded-lg border-0 bg-light-50 py-2 pl-9 pr-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500"
        />
      </div>

      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-light-600 dark:divide-dark-600">
          <thead className="bg-light-300 dark:bg-dark-200">
            <tr>
              <th className="py-3 pl-4 pr-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`User`}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Role`}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Workspaces`}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Joined`}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
            {isLoading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-light-900 dark:text-dark-900"
                >
                  {t`Loading…`}
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-light-900 dark:text-dark-900"
                >
                  {t`No users found`}
                </td>
              </tr>
            )}
            {!isLoading &&
              users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/admin/members/${user.id}`)}
                  className="cursor-pointer hover:bg-light-100 dark:hover:bg-dark-200"
                >
                  <td className="py-3 pl-4 pr-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={user.name ?? ""}
                        email={user.email}
                        imageUrl={
                          user.image ? getAvatarUrl(user.image) : undefined
                        }
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-dark-1000">
                          {user.name ?? user.email}
                        </p>
                        <p className="truncate text-xs text-light-900 dark:text-dark-900">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        user.role === "admin"
                          ? "inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20"
                          : "inline-flex items-center rounded-md bg-gray-500/10 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 ring-1 ring-inset ring-gray-500/20"
                      }
                    >
                      {user.role === "admin" ? t`Admin` : t`User`}
                    </span>
                    {user.banned && (
                      <span className="ml-1.5 inline-flex items-center rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-400 ring-1 ring-inset ring-red-500/20">
                        {t`Banned`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-light-1000 dark:text-dark-1000">
                    {user.workspaceCount}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-light-900 dark:text-dark-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </>
  );
}
