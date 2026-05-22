import Link from "next/link";
import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { HiArrowLeft } from "react-icons/hi2";

import Avatar from "~/components/Avatar";
import LoadingSpinner from "~/components/LoadingSpinner";
import { PageHead } from "~/components/PageHead";
import { api } from "~/utils/api";
import { getAvatarUrl } from "~/utils/helpers";

export function MemberDetail() {
  const router = useRouter();
  const userId =
    typeof router.query.userId === "string" ? router.query.userId : undefined;

  const { data, isLoading } = api.admin.getUser.useQuery(
    { userId: userId ?? "" },
    { enabled: !!userId },
  );

  if (isLoading || !data) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        {isLoading ? (
          <LoadingSpinner size="lg" />
        ) : (
          <p className="text-sm text-light-900 dark:text-dark-900">
            {t`User not found`}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHead title={t`Admin | ${data.name ?? data.email}`} />

      <Link
        href="/admin/members"
        className="mb-4 inline-flex items-center gap-1 text-sm text-light-900 hover:text-light-1000 dark:text-dark-900 dark:hover:text-dark-1000"
      >
        <HiArrowLeft className="h-4 w-4" />
        {t`Back to members`}
      </Link>

      <div className="mb-8 rounded-lg border border-light-300 bg-light-50 p-5 dark:border-dark-300 dark:bg-dark-50">
        <div className="flex items-center gap-4">
          <Avatar
            name={data.name ?? ""}
            email={data.email}
            imageUrl={data.image ? getAvatarUrl(data.image) : undefined}
            size="lg"
          />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-dark-1000">
              {data.name ?? data.email}
            </h2>
            <p className="text-sm text-light-900 dark:text-dark-900">
              {data.email}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-light-900 dark:text-dark-900">{t`Role`}</dt>
            <dd className="text-sm capitalize text-light-1000 dark:text-dark-1000">
              {data.role === "admin" ? t`Instance admin` : t`User`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-light-900 dark:text-dark-900">
              {t`Status`}
            </dt>
            <dd className="text-sm text-light-1000 dark:text-dark-1000">
              {data.banned ? t`Banned` : t`Active`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-light-900 dark:text-dark-900">
              {t`Joined`}
            </dt>
            <dd className="text-sm text-light-1000 dark:text-dark-1000">
              {new Date(data.createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-dark-1000">
        {t`Workspace memberships`}
      </h3>
      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-light-600 dark:divide-dark-600">
          <thead className="bg-light-300 dark:bg-dark-200">
            <tr>
              <th className="py-3 pl-4 pr-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Workspace`}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Role`}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Status`}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Joined`}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
            {data.memberships.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-light-900 dark:text-dark-900"
                >
                  {t`Not a member of any workspace`}
                </td>
              </tr>
            )}
            {data.memberships.map((membership) => (
              <tr
                key={membership.publicId}
                onClick={() =>
                  router.push(
                    `/admin/workspaces/${membership.workspace.publicId}`,
                  )
                }
                className="cursor-pointer hover:bg-light-100 dark:hover:bg-dark-200"
              >
                <td className="py-3 pl-4 pr-3">
                  <p className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
                    {membership.workspace.name}
                  </p>
                  <p className="text-xs text-light-900 dark:text-dark-900">
                    /{membership.workspace.slug}
                  </p>
                </td>
                <td className="px-3 py-3 text-sm capitalize text-light-1000 dark:text-dark-1000">
                  {membership.role}
                </td>
                <td className="px-3 py-3 text-sm capitalize text-light-1000 dark:text-dark-1000">
                  {membership.status}
                </td>
                <td className="px-3 py-3 text-right text-sm text-light-900 dark:text-dark-900">
                  {new Date(membership.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
