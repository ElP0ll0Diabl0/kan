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
import { AddMembershipModal } from "./components/AddMembershipModal";
import { ConfirmDialog } from "./components/ConfirmDialog";

type WorkspaceRole = "admin" | "member" | "guest";

type Dialog =
  | { type: "promote" }
  | { type: "demote" }
  | { type: "ban" }
  | { type: "unban" }
  | {
      type: "removeMembership";
      workspacePublicId: string;
      memberPublicId: string;
      workspaceName: string;
    }
  | null;

export function MemberDetail() {
  const router = useRouter();
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const userId =
    typeof router.query.userId === "string" ? router.query.userId : undefined;

  const [dialog, setDialog] = useState<Dialog>(null);
  const [banReason, setBanReason] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data, isLoading } = api.admin.getUser.useQuery(
    { userId: userId ?? "" },
    { enabled: !!userId },
  );
  const { data: currentUser } = api.user.getUser.useQuery();

  const closeDialog = () => {
    setDialog(null);
    setBanReason("");
  };

  const onSuccess = (header: string, message: string) => async () => {
    if (userId) await utils.admin.getUser.invalidate({ userId });
    showPopup({ header, message, icon: "success" });
    closeDialog();
  };

  const onError = (header: string) => (error: { message: string }) => {
    showPopup({ header, message: error.message, icon: "error" });
  };

  const setUserRole = api.admin.setUserRole.useMutation({
    onSuccess: onSuccess(t`Role updated`, t`The user's role has been updated.`),
    onError: onError(t`Unable to update role`),
  });
  const banUser = api.admin.banUser.useMutation({
    onSuccess: onSuccess(t`User banned`, t`The user has been banned.`),
    onError: onError(t`Unable to ban user`),
  });
  const unbanUser = api.admin.unbanUser.useMutation({
    onSuccess: onSuccess(t`User unbanned`, t`The user has been unbanned.`),
    onError: onError(t`Unable to unban user`),
  });
  const updateMemberRole = api.admin.updateWorkspaceMemberRole.useMutation({
    onSuccess: onSuccess(
      t`Role updated`,
      t`The member's role has been updated.`,
    ),
    onError: onError(t`Unable to update role`),
  });
  const removeMember = api.admin.removeWorkspaceMember.useMutation({
    onSuccess: onSuccess(
      t`Member removed`,
      t`The user has been removed from the workspace.`,
    ),
    onError: onError(t`Unable to remove member`),
  });

  if (isLoading || !data || !userId) {
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

  const isSelf = currentUser?.id === data.id;
  const dialogLoading =
    setUserRole.isPending ||
    banUser.isPending ||
    unbanUser.isPending ||
    removeMember.isPending;

  const dialogProps = (() => {
    switch (dialog?.type) {
      case "promote":
        return {
          title: t`Promote to instance admin?`,
          message: t`This grants full access to the admin area for every workspace.`,
          confirmLabel: t`Promote`,
          onConfirm: () => setUserRole.mutate({ userId, role: "admin" }),
        };
      case "demote":
        return {
          title: t`Remove instance admin access?`,
          message: t`This user will lose access to the admin area.`,
          confirmLabel: t`Remove access`,
          onConfirm: () => setUserRole.mutate({ userId, role: "user" }),
        };
      case "ban":
        return {
          title: t`Ban this user?`,
          message: t`They will be signed out and unable to access Kan.`,
          confirmLabel: t`Ban`,
          onConfirm: () =>
            banUser.mutate({ userId, reason: banReason.trim() || undefined }),
        };
      case "unban":
        return {
          title: t`Unban this user?`,
          message: t`They will be able to sign in again.`,
          confirmLabel: t`Unban`,
          onConfirm: () => unbanUser.mutate({ userId }),
        };
      case "removeMembership":
        return {
          title: t`Remove from ${dialog.workspaceName}?`,
          message: t`They will lose access to this workspace.`,
          confirmLabel: t`Remove`,
          onConfirm: () =>
            removeMember.mutate({
              workspacePublicId: dialog.workspacePublicId,
              memberPublicId: dialog.memberPublicId,
            }),
        };
      default:
        return null;
    }
  })();

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
        <div className="flex flex-wrap items-center justify-between gap-4">
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
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={isSelf}
              onClick={() =>
                setDialog({
                  type: data.role === "admin" ? "demote" : "promote",
                })
              }
            >
              {data.role === "admin" ? t`Remove admin` : t`Make admin`}
            </Button>
            <Button
              variant="secondary"
              disabled={isSelf}
              onClick={() => setDialog({ type: data.banned ? "unban" : "ban" })}
            >
              {data.banned ? t`Unban` : t`Ban`}
            </Button>
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

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-dark-1000">
          {t`Workspace memberships`}
        </h3>
        <Button
          variant="secondary"
          iconLeft={<HiOutlinePlusSmall className="h-4 w-4" />}
          onClick={() => setIsAddOpen(true)}
        >
          {t`Add to workspace`}
        </Button>
      </div>
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
                {t`Actions`}
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
              <tr key={membership.publicId}>
                <td className="py-3 pl-4 pr-3">
                  <Link
                    href={`/admin/workspaces/${membership.workspace.publicId}`}
                    className="text-sm font-medium text-neutral-900 hover:underline dark:text-dark-1000"
                  >
                    {membership.workspace.name}
                  </Link>
                  <p className="text-xs text-light-900 dark:text-dark-900">
                    /{membership.workspace.slug}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={membership.role}
                    onChange={(e) =>
                      updateMemberRole.mutate({
                        workspacePublicId: membership.workspace.publicId,
                        memberPublicId: membership.publicId,
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
                  {membership.status}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setDialog({
                        type: "removeMembership",
                        workspacePublicId: membership.workspace.publicId,
                        memberPublicId: membership.publicId,
                        workspaceName: membership.workspace.name,
                      })
                    }
                    className="text-sm text-light-900 hover:text-neutral-900 dark:text-dark-900 dark:hover:text-dark-1000"
                  >
                    {t`Remove`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialogProps && (
        <ConfirmDialog
          isOpen
          title={dialogProps.title}
          message={dialogProps.message}
          confirmLabel={dialogProps.confirmLabel}
          isLoading={dialogLoading}
          onConfirm={dialogProps.onConfirm}
          onClose={closeDialog}
        >
          {dialog?.type === "ban" && (
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder={t`Reason (optional)`}
              className="mt-3 w-full rounded-lg border-0 bg-light-50 px-3 py-2 text-sm text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300"
            />
          )}
        </ConfirmDialog>
      )}

      <AddMembershipModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        userId={userId}
        existingWorkspacePublicIds={data.memberships.map(
          (m) => m.workspace.publicId,
        )}
      />
    </>
  );
}
