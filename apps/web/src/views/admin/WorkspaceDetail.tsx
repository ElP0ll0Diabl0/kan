import Link from "next/link";
import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiArrowLeft, HiOutlinePlusSmall } from "react-icons/hi2";

import Avatar from "~/components/Avatar";
import Button from "~/components/Button";
import LoadingSpinner from "~/components/LoadingSpinner";
import { PageHead } from "~/components/PageHead";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { getAvatarUrl } from "~/utils/helpers";
import { AddMemberModal } from "./components/AddMemberModal";
import { ConfirmDialog } from "./components/ConfirmDialog";

type WorkspaceRole = "admin" | "member" | "guest";

export function WorkspaceDetail() {
  const router = useRouter();
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const workspaceId =
    typeof router.query.workspaceId === "string"
      ? router.query.workspaceId
      : undefined;

  const [removeTarget, setRemoveTarget] = useState<{
    memberPublicId: string;
    label: string;
  } | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data, isLoading } = api.admin.getWorkspace.useQuery(
    { workspacePublicId: workspaceId ?? "" },
    { enabled: !!workspaceId },
  );

  const onError = (header: string) => (error: { message: string }) => {
    showPopup({ header, message: error.message, icon: "error" });
  };

  const invalidate = async () => {
    if (workspaceId)
      await utils.admin.getWorkspace.invalidate({
        workspacePublicId: workspaceId,
      });
  };

  const updateMemberRole = api.admin.updateWorkspaceMemberRole.useMutation({
    onSuccess: async () => {
      await invalidate();
      showPopup({
        header: t`Role updated`,
        message: t`The member's role has been updated.`,
        icon: "success",
      });
    },
    onError: onError(t`Unable to update role`),
  });
  const removeMember = api.admin.removeWorkspaceMember.useMutation({
    onSuccess: async () => {
      await invalidate();
      showPopup({
        header: t`Member removed`,
        message: t`The member has been removed from the workspace.`,
        icon: "success",
      });
      setRemoveTarget(null);
    },
    onError: onError(t`Unable to remove member`),
  });

  if (isLoading || !data || !workspaceId) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        {isLoading ? (
          <LoadingSpinner size="lg" />
        ) : (
          <p className="text-sm text-light-900 dark:text-dark-900">
            {t`Workspace not found`}
          </p>
        )}
      </div>
    );
  }

  const existingUserIds = data.members
    .map((member) => member.user?.id)
    .filter((id): id is string => !!id);

  return (
    <>
      <PageHead title={t`Admin | ${data.name}`} />

      <Link
        href="/admin/workspaces"
        className="mb-4 inline-flex items-center gap-1 text-sm text-light-900 hover:text-light-1000 dark:text-dark-900 dark:hover:text-dark-1000"
      >
        <HiArrowLeft className="h-4 w-4" />
        {t`Back to workspaces`}
      </Link>

      <div className="mb-8 rounded-lg border border-light-300 bg-light-50 p-5 dark:border-dark-300 dark:bg-dark-50">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-dark-1000">
          {data.name}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-light-900 dark:text-dark-900">{t`Slug`}</dt>
            <dd className="text-sm text-light-1000 dark:text-dark-1000">
              /{data.slug}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-light-900 dark:text-dark-900">{t`Plan`}</dt>
            <dd className="text-sm capitalize text-light-1000 dark:text-dark-1000">
              {data.plan}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-light-900 dark:text-dark-900">
              {t`Boards`}
            </dt>
            <dd className="text-sm text-light-1000 dark:text-dark-1000">
              {data.boards.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-light-900 dark:text-dark-900">
              {t`Created`}
            </dt>
            <dd className="text-sm text-light-1000 dark:text-dark-1000">
              {new Date(data.createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-dark-1000">
        {t`Boards`}
      </h3>
      <div className="mb-8 overflow-x-auto shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-light-600 dark:divide-dark-600">
          <thead className="bg-light-300 dark:bg-dark-200">
            <tr>
              <th className="py-3 pl-4 pr-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Board`}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Visibility`}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Access`}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Status`}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Created`}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
            {data.boards.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-light-900 dark:text-dark-900"
                >
                  {t`No boards`}
                </td>
              </tr>
            )}
            {data.boards.map((board) => (
              <tr key={board.publicId}>
                <td className="py-3 pl-4 pr-3 text-sm font-medium text-neutral-900 dark:text-dark-1000">
                  {board.name}
                </td>
                <td className="px-3 py-3 text-sm capitalize text-light-1000 dark:text-dark-1000">
                  {board.visibility}
                </td>
                <td className="px-3 py-3 text-sm text-light-1000 dark:text-dark-1000">
                  {board.accessLevel === "restricted"
                    ? t`Restricted`
                    : t`Workspace`}
                </td>
                <td className="px-3 py-3 text-sm text-light-1000 dark:text-dark-1000">
                  {board.isArchived ? t`Archived` : t`Active`}
                </td>
                <td className="px-3 py-3 text-right text-sm text-light-900 dark:text-dark-900">
                  {new Date(board.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-dark-1000">
          {t`Members`}
        </h3>
        <Button
          variant="secondary"
          iconLeft={<HiOutlinePlusSmall className="h-4 w-4" />}
          onClick={() => setIsAddOpen(true)}
        >
          {t`Add member`}
        </Button>
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
              <th className="px-3 py-3 text-left text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Status`}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-light-900 dark:text-dark-900">
                {t`Actions`}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
            {data.members.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-light-900 dark:text-dark-900"
                >
                  {t`No members`}
                </td>
              </tr>
            )}
            {data.members.map((member) => {
              const displayName =
                member.user?.name ?? member.user?.email ?? member.email;
              return (
                <tr key={member.publicId}>
                  <td className="py-3 pl-4 pr-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={member.user?.name ?? ""}
                        email={member.user?.email ?? member.email}
                        imageUrl={
                          member.user?.image
                            ? getAvatarUrl(member.user.image)
                            : undefined
                        }
                      />
                      <div className="min-w-0">
                        {member.user?.id ? (
                          <Link
                            href={`/admin/members/${member.user.id}`}
                            className="block truncate text-sm font-medium text-neutral-900 hover:underline dark:text-dark-1000"
                          >
                            {displayName}
                          </Link>
                        ) : (
                          <p className="truncate text-sm font-medium text-neutral-900 dark:text-dark-1000">
                            {displayName}
                          </p>
                        )}
                        <p className="truncate text-xs text-light-900 dark:text-dark-900">
                          {member.user?.email ?? member.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateMemberRole.mutate({
                          workspacePublicId: workspaceId,
                          memberPublicId: member.publicId,
                          role: e.target.value as WorkspaceRole,
                        })
                      }
                      className="rounded-md border-0 bg-light-50 py-1 pl-2 pr-7 text-sm text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300"
                    >
                      <option value="admin">{t`Admin`}</option>
                      <option value="member">{t`Member`}</option>
                      <option value="guest">{t`Guest`}</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 text-sm capitalize text-light-1000 dark:text-dark-1000">
                    {member.status}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setRemoveTarget({
                          memberPublicId: member.publicId,
                          label: displayName,
                        })
                      }
                      className="text-sm text-light-900 hover:text-neutral-900 dark:text-dark-900 dark:hover:text-dark-1000"
                    >
                      {t`Remove`}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {removeTarget && (
        <ConfirmDialog
          isOpen
          title={t`Remove ${removeTarget.label}?`}
          message={t`They will lose access to this workspace.`}
          confirmLabel={t`Remove`}
          isLoading={removeMember.isPending}
          onConfirm={() =>
            removeMember.mutate({
              workspacePublicId: workspaceId,
              memberPublicId: removeTarget.memberPublicId,
            })
          }
          onClose={() => setRemoveTarget(null)}
        />
      )}

      <AddMemberModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        workspacePublicId={workspaceId}
        existingUserIds={existingUserIds}
      />
    </>
  );
}
