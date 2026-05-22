import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import Button from "~/components/Button";
import Modal from "~/components/modal";
import { useDebounce } from "~/hooks/useDebounce";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

type WorkspaceRole = "admin" | "member" | "guest";

interface AddMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  existingWorkspacePublicIds: string[];
}

/** Picks a workspace and adds the given user to it as an active member. */
export function AddMembershipModal({
  isOpen,
  onClose,
  userId,
  existingWorkspacePublicIds,
}: AddMembershipModalProps) {
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [role, setRole] = useState<WorkspaceRole>("member");

  const { data, isLoading } = api.admin.listWorkspaces.useQuery(
    { limit: 8, offset: 0, search: debouncedSearch || undefined },
    { enabled: isOpen },
  );

  const handleClose = () => {
    setSearch("");
    setSelectedWorkspaceId(null);
    setRole("member");
    onClose();
  };

  const addMember = api.admin.addWorkspaceMember.useMutation({
    onSuccess: async () => {
      await utils.admin.getUser.invalidate({ userId });
      showPopup({
        header: t`Workspace added`,
        message: t`The user has been added to the workspace.`,
        icon: "success",
      });
      handleClose();
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to add to workspace`,
        message: error.message,
        icon: "error",
      });
    },
  });

  return (
    <Modal modalSize="sm" isVisible={isOpen} closeOnClickOutside={false}>
      <div className="p-5">
        <h2 className="text-md pb-4 font-medium text-neutral-900 dark:text-dark-1000">
          {t`Add to workspace`}
        </h2>

        <div className="relative">
          <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-900 dark:text-dark-900" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t`Search workspaces`}
            className="w-full rounded-lg border-0 bg-light-50 py-2 pl-9 pr-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500"
          />
        </div>

        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg ring-1 ring-light-300 dark:ring-dark-300">
          {isLoading && (
            <p className="p-3 text-sm text-light-900 dark:text-dark-900">
              {t`Loading…`}
            </p>
          )}
          {!isLoading && (data?.workspaces.length ?? 0) === 0 && (
            <p className="p-3 text-sm text-light-900 dark:text-dark-900">
              {t`No workspaces found`}
            </p>
          )}
          {data?.workspaces.map((workspace) => {
            const isMember = existingWorkspacePublicIds.includes(
              workspace.publicId,
            );
            return (
              <button
                key={workspace.publicId}
                type="button"
                disabled={isMember}
                onClick={() => setSelectedWorkspaceId(workspace.publicId)}
                className={twMerge(
                  "flex w-full items-center justify-between gap-2 p-2 text-left",
                  isMember
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-light-200 dark:hover:bg-dark-200",
                  selectedWorkspaceId === workspace.publicId &&
                    "bg-light-200 dark:bg-dark-200",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-neutral-900 dark:text-dark-1000">
                    {workspace.name}
                  </span>
                  <span className="block truncate text-xs text-light-900 dark:text-dark-900">
                    /{workspace.slug}
                  </span>
                </span>
                {isMember && (
                  <span className="text-xs text-light-900 dark:text-dark-900">
                    {t`Already a member`}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <label className="mt-4 block text-xs text-light-900 dark:text-dark-900">
          {t`Role`}
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as WorkspaceRole)}
          className="mt-1 w-full rounded-lg border-0 bg-light-50 py-2 pl-3 pr-8 text-sm text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300"
        >
          <option value="admin">{t`Admin`}</option>
          <option value="member">{t`Member`}</option>
          <option value="guest">{t`Guest`}</option>
        </select>

        <div className="mt-6 flex justify-end space-x-2">
          <Button variant="secondary" onClick={handleClose}>
            {t`Cancel`}
          </Button>
          <Button
            onClick={() =>
              selectedWorkspaceId &&
              addMember.mutate({
                workspacePublicId: selectedWorkspaceId,
                userId,
                role,
              })
            }
            isLoading={addMember.isPending}
            disabled={!selectedWorkspaceId}
          >
            {t`Add`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
