import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import Avatar from "~/components/Avatar";
import Button from "~/components/Button";
import Modal from "~/components/modal";
import { useDebounce } from "~/hooks/useDebounce";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { getAvatarUrl } from "~/utils/helpers";

type WorkspaceRole = "admin" | "member" | "guest";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePublicId: string;
  existingUserIds: string[];
}

/** Picks an existing user and adds them to the given workspace. */
export function AddMemberModal({
  isOpen,
  onClose,
  workspacePublicId,
  existingUserIds,
}: AddMemberModalProps) {
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("member");

  const { data, isLoading } = api.admin.listUsers.useQuery(
    { limit: 8, offset: 0, search: debouncedSearch || undefined },
    { enabled: isOpen },
  );

  const handleClose = () => {
    setSearch("");
    setSelectedUserId(null);
    setRole("member");
    onClose();
  };

  const addMember = api.admin.addWorkspaceMember.useMutation({
    onSuccess: async () => {
      await utils.admin.getWorkspace.invalidate({ workspacePublicId });
      showPopup({
        header: t`Member added`,
        message: t`The user has been added to the workspace.`,
        icon: "success",
      });
      handleClose();
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to add member`,
        message: error.message,
        icon: "error",
      });
    },
  });

  return (
    <Modal modalSize="sm" isVisible={isOpen} closeOnClickOutside={false}>
      <div className="p-5">
        <h2 className="text-md pb-4 font-medium text-neutral-900 dark:text-dark-1000">
          {t`Add member`}
        </h2>

        <div className="relative">
          <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-900 dark:text-dark-900" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t`Search users`}
            className="w-full rounded-lg border-0 bg-light-50 py-2 pl-9 pr-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500"
          />
        </div>

        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg ring-1 ring-light-300 dark:ring-dark-300">
          {isLoading && (
            <p className="p-3 text-sm text-light-900 dark:text-dark-900">
              {t`Loading…`}
            </p>
          )}
          {!isLoading && (data?.users.length ?? 0) === 0 && (
            <p className="p-3 text-sm text-light-900 dark:text-dark-900">
              {t`No users found`}
            </p>
          )}
          {data?.users.map((user) => {
            const isMember = existingUserIds.includes(user.id);
            return (
              <button
                key={user.id}
                type="button"
                disabled={isMember}
                onClick={() => setSelectedUserId(user.id)}
                className={twMerge(
                  "flex w-full items-center gap-2 p-2 text-left",
                  isMember
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-light-200 dark:hover:bg-dark-200",
                  selectedUserId === user.id &&
                    "bg-light-200 dark:bg-dark-200",
                )}
              >
                <Avatar
                  size="sm"
                  name={user.name ?? ""}
                  email={user.email}
                  imageUrl={user.image ? getAvatarUrl(user.image) : undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-neutral-900 dark:text-dark-1000">
                    {user.name ?? user.email}
                  </span>
                  <span className="block truncate text-xs text-light-900 dark:text-dark-900">
                    {user.email}
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
              selectedUserId &&
              addMember.mutate({
                workspacePublicId,
                userId: selectedUserId,
                role,
              })
            }
            isLoading={addMember.isPending}
            disabled={!selectedUserId}
          >
            {t`Add`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
