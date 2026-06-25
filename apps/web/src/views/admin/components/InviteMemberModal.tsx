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
type BoardRole = "viewer" | "editor" | "admin";

const inputClasses =
  "w-full rounded-lg border-0 bg-light-50 py-2 pl-3 pr-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500";

const roleSelectClasses =
  "rounded-md border-0 bg-light-50 py-1 pl-2 pr-7 text-xs text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300";

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Invites a user by email into a workspace, with an optional set of
 * restricted-board grants and a chosen workspace role.
 */
export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const [email, setEmail] = useState("");
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [debouncedSearch] = useDebounce(workspaceSearch, 300);
  const [selectedWorkspacePublicId, setSelectedWorkspacePublicId] = useState<
    string | null
  >(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("member");
  const [selectedBoards, setSelectedBoards] = useState<
    Record<string, BoardRole>
  >({});

  const { data: workspaceData, isLoading: workspacesLoading } =
    api.admin.listWorkspaces.useQuery(
      { limit: 8, offset: 0, search: debouncedSearch || undefined },
      { enabled: isOpen },
    );

  const { data: boards, isLoading: boardsLoading } =
    api.admin.listRestrictedBoards.useQuery(
      { workspacePublicId: selectedWorkspacePublicId ?? "" },
      { enabled: isOpen && !!selectedWorkspacePublicId },
    );

  const handleClose = () => {
    setEmail("");
    setWorkspaceSearch("");
    setSelectedWorkspacePublicId(null);
    setWorkspaceRole("member");
    setSelectedBoards({});
    onClose();
  };

  const selectWorkspace = (publicId: string) => {
    setSelectedWorkspacePublicId(publicId);
    // Board selection is workspace-scoped, so reset it on change.
    setSelectedBoards({});
  };

  const toggleBoard = (boardPublicId: string) => {
    setSelectedBoards((prev) => {
      const next = { ...prev };
      if (next[boardPublicId]) {
        delete next[boardPublicId];
      } else {
        next[boardPublicId] = "editor";
      }
      return next;
    });
  };

  const setBoardRole = (boardPublicId: string, role: BoardRole) => {
    setSelectedBoards((prev) => ({ ...prev, [boardPublicId]: role }));
  };

  const inviteMember = api.admin.inviteMember.useMutation({
    onSuccess: async (res) => {
      await utils.admin.listUsers.invalidate();
      if (selectedWorkspacePublicId) {
        await utils.admin.getWorkspace.invalidate({
          workspacePublicId: selectedWorkspacePublicId,
        });
      }
      showPopup({
        header: res.status === "active" ? t`Member added` : t`Invitation sent`,
        message:
          res.status === "active"
            ? t`The user has been added to the workspace.`
            : t`An invitation email has been sent. Board access will be granted when they accept.`,
        icon: "success",
      });
      handleClose();
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to invite member`,
        message: error.message,
        icon: "error",
      });
    },
  });

  const canSubmit =
    isValidEmail(email) &&
    !!selectedWorkspacePublicId &&
    !inviteMember.isPending;

  const handleSubmit = () => {
    if (!selectedWorkspacePublicId || !isValidEmail(email)) return;
    inviteMember.mutate({
      email: email.trim(),
      workspacePublicId: selectedWorkspacePublicId,
      workspaceRole,
      boards: Object.entries(selectedBoards).map(([boardPublicId, role]) => ({
        boardPublicId,
        role,
      })),
    });
  };

  return (
    <Modal modalSize="md" isVisible={isOpen} closeOnClickOutside={false}>
      <div className="p-5">
        <h2 className="text-md pb-4 font-medium text-neutral-900 dark:text-dark-1000">
          {t`Invite member`}
        </h2>

        <label className="block text-xs text-light-900 dark:text-dark-900">
          {t`Email`}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t`name@company.com`}
          className={twMerge(inputClasses, "mt-1")}
        />

        <label className="mt-4 block text-xs text-light-900 dark:text-dark-900">
          {t`Workspace`}
        </label>
        <div className="relative mt-1">
          <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-900 dark:text-dark-900" />
          <input
            type="text"
            value={workspaceSearch}
            onChange={(e) => setWorkspaceSearch(e.target.value)}
            placeholder={t`Search workspaces`}
            className={twMerge(inputClasses, "pl-9")}
          />
        </div>

        <div className="mt-2 max-h-40 overflow-y-auto rounded-lg ring-1 ring-light-300 dark:ring-dark-300">
          {workspacesLoading && (
            <p className="p-3 text-sm text-light-900 dark:text-dark-900">
              {t`Loading…`}
            </p>
          )}
          {!workspacesLoading &&
            (workspaceData?.workspaces.length ?? 0) === 0 && (
              <p className="p-3 text-sm text-light-900 dark:text-dark-900">
                {t`No workspaces found`}
              </p>
            )}
          {workspaceData?.workspaces.map((workspace) => (
            <button
              key={workspace.publicId}
              type="button"
              onClick={() => selectWorkspace(workspace.publicId)}
              className={twMerge(
                "flex w-full items-center justify-between gap-2 p-2 text-left hover:bg-light-200 dark:hover:bg-dark-200",
                selectedWorkspacePublicId === workspace.publicId &&
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
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs text-light-900 dark:text-dark-900">
          {t`Workspace role`}
        </label>
        <select
          value={workspaceRole}
          onChange={(e) => setWorkspaceRole(e.target.value as WorkspaceRole)}
          className="mt-1 w-full rounded-lg border-0 bg-light-50 py-2 pl-3 pr-8 text-sm text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300"
        >
          <option value="admin">{t`Admin`}</option>
          <option value="member">{t`Member`}</option>
          <option value="guest">{t`Guest`}</option>
        </select>

        {selectedWorkspacePublicId && (
          <div className="mt-4">
            <label className="block text-xs text-light-900 dark:text-dark-900">
              {t`Board access`}
            </label>
            <p className="mb-2 mt-1 text-xs text-light-900 dark:text-dark-900">
              {t`Grant access to restricted boards. Workspace-access boards are open to all members.`}
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-light-300 dark:ring-dark-300">
              {boardsLoading && (
                <p className="p-3 text-sm text-light-900 dark:text-dark-900">
                  {t`Loading…`}
                </p>
              )}
              {!boardsLoading && (boards?.length ?? 0) === 0 && (
                <p className="p-3 text-sm text-light-900 dark:text-dark-900">
                  {t`No restricted boards in this workspace`}
                </p>
              )}
              {boards?.map((board) => {
                const selected = selectedBoards[board.publicId];
                return (
                  <div
                    key={board.publicId}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleBoard(board.publicId)}
                        className="h-4 w-4 rounded border-light-400 dark:border-dark-400"
                      />
                      <span className="min-w-0 truncate text-sm text-neutral-900 dark:text-dark-1000">
                        {board.name}
                      </span>
                    </label>
                    <select
                      value={selected ?? "editor"}
                      disabled={!selected}
                      onChange={(e) =>
                        setBoardRole(
                          board.publicId,
                          e.target.value as BoardRole,
                        )
                      }
                      className={twMerge(
                        roleSelectClasses,
                        !selected && "opacity-50",
                      )}
                    >
                      <option value="viewer">{t`Viewer`}</option>
                      <option value="editor">{t`Editor`}</option>
                      <option value="admin">{t`Admin`}</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-2">
          <Button variant="secondary" onClick={handleClose}>
            {t`Cancel`}
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={inviteMember.isPending}
            disabled={!canSubmit}
          >
            {t`Invite`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
