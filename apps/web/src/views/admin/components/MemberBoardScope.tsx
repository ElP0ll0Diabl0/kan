import { t } from "@lingui/core/macro";
import { useState } from "react";

import Button from "~/components/Button";
import LoadingSpinner from "~/components/LoadingSpinner";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

type BoardRole = "viewer" | "editor" | "admin";

interface BoardScopeItem {
  publicId: string;
  name: string;
  member: { publicId: string; role: BoardRole } | null;
}

const roleSelectClasses =
  "rounded-md border-0 bg-light-50 py-1 pl-2 pr-7 text-xs text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300";

function BoardRow({
  board,
  userId,
  onMutated,
}: {
  board: BoardScopeItem;
  userId: string;
  onMutated: () => Promise<void>;
}) {
  const { showPopup } = usePopup();
  const [addRole, setAddRole] = useState<BoardRole>("editor");

  const onError = (header: string) => (error: { message: string }) => {
    showPopup({ header, message: error.message, icon: "error" });
  };

  const addMember = api.admin.addBoardMember.useMutation({
    onSuccess: onMutated,
    onError: onError(t`Unable to add to board`),
  });
  const updateRole = api.admin.updateBoardMemberRole.useMutation({
    onSuccess: onMutated,
    onError: onError(t`Unable to update board role`),
  });
  const removeMember = api.admin.removeBoardMember.useMutation({
    onSuccess: onMutated,
    onError: onError(t`Unable to remove from board`),
  });

  const isPending =
    addMember.isPending || updateRole.isPending || removeMember.isPending;

  const member = board.member;

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-900 dark:text-dark-1000">
        {board.name}
      </span>

      {member ? (
        <>
          <select
            value={member.role}
            disabled={isPending}
            onChange={(e) =>
              updateRole.mutate({
                boardPublicId: board.publicId,
                boardMemberPublicId: member.publicId,
                role: e.target.value as BoardRole,
              })
            }
            className={roleSelectClasses}
          >
            <option value="viewer">{t`Viewer`}</option>
            <option value="editor">{t`Editor`}</option>
            <option value="admin">{t`Admin`}</option>
          </select>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              removeMember.mutate({
                boardPublicId: board.publicId,
                boardMemberPublicId: member.publicId,
              })
            }
            className="text-xs text-light-900 hover:text-neutral-900 disabled:opacity-50 dark:text-dark-900 dark:hover:text-dark-1000"
          >
            {t`Remove`}
          </button>
        </>
      ) : (
        <>
          <select
            value={addRole}
            disabled={isPending}
            onChange={(e) => setAddRole(e.target.value as BoardRole)}
            className={roleSelectClasses}
          >
            <option value="viewer">{t`Viewer`}</option>
            <option value="editor">{t`Editor`}</option>
            <option value="admin">{t`Admin`}</option>
          </select>
          <Button
            size="xs"
            variant="secondary"
            isLoading={addMember.isPending}
            disabled={isPending}
            onClick={() =>
              addMember.mutate({
                boardPublicId: board.publicId,
                userId,
                role: addRole,
              })
            }
          >
            {t`Add`}
          </Button>
        </>
      )}
    </div>
  );
}

export function MemberBoardScope({
  userId,
  workspacePublicId,
  workspaceName,
}: {
  userId: string;
  workspacePublicId: string;
  workspaceName: string;
}) {
  const utils = api.useUtils();
  const { data, isLoading } = api.admin.listUserBoardScope.useQuery({
    userId,
    workspacePublicId,
  });

  const refetch = () =>
    utils.admin.listUserBoardScope.invalidate({ userId, workspacePublicId });

  return (
    <div className="rounded-lg border border-light-300 bg-light-50 p-4 dark:border-dark-300 dark:bg-dark-50">
      <h4 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-dark-1000">
        {workspaceName}
      </h4>
      <p className="mb-3 text-xs text-light-900 dark:text-dark-900">
        {t`Manage access to restricted boards. Workspace-access boards are open to all workspace members.`}
      </p>

      {isLoading ? (
        <div className="flex h-16 items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-light-900 dark:text-dark-900">
          {t`No restricted boards in this workspace.`}
        </p>
      ) : (
        <div className="divide-y divide-light-300 dark:divide-dark-300">
          {data.map((board) => (
            <BoardRow
              key={board.publicId}
              board={board}
              userId={userId}
              onMutated={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
