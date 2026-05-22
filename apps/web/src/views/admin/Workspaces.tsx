import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";

import { PageHead } from "~/components/PageHead";
import { useDebounce } from "~/hooks/useDebounce";
import { api } from "~/utils/api";
import { AdminPagination } from "./components/AdminPagination";

const PAGE_SIZE = 25;

export function Workspaces() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [debouncedSearch] = useDebounce(search, 300);

  const { data, isLoading } = api.admin.listWorkspaces.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const workspaces = data?.workspaces ?? [];

  return (
    <>
      <PageHead title={t`Admin | Workspaces`} />
      <div className="relative mb-4 max-w-sm">
        <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-900 dark:text-dark-900" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder={t`Search workspaces`}
          className="w-full rounded-lg border-0 bg-light-50 py-2 pl-9 pr-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500"
        />
      </div>

      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-light-600 dark:divide-dark-600">
          <thead className="bg-light-300 dark:bg-dark-200">
            <tr>
              <th className="py-3 pl-4 pr-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Workspace`}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Plan`}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Members`}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Boards`}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Created`}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
            {isLoading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-light-900 dark:text-dark-900"
                >
                  {t`Loading…`}
                </td>
              </tr>
            )}
            {!isLoading && workspaces.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-light-900 dark:text-dark-900"
                >
                  {t`No workspaces found`}
                </td>
              </tr>
            )}
            {!isLoading &&
              workspaces.map((workspace) => (
                <tr
                  key={workspace.publicId}
                  onClick={() =>
                    router.push(`/admin/workspaces/${workspace.publicId}`)
                  }
                  className="cursor-pointer hover:bg-light-100 dark:hover:bg-dark-200"
                >
                  <td className="py-3 pl-4 pr-3">
                    <p className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
                      {workspace.name}
                    </p>
                    <p className="text-xs text-light-900 dark:text-dark-900">
                      /{workspace.slug}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-sm capitalize text-light-1000 dark:text-dark-1000">
                    {workspace.plan}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-light-1000 dark:text-dark-1000">
                    {workspace.memberCount}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-light-1000 dark:text-dark-1000">
                    {workspace.boardCount}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-light-900 dark:text-dark-900">
                    {new Date(workspace.createdAt).toLocaleDateString()}
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
