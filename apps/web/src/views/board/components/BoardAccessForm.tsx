import { t } from "@lingui/core/macro";
import { useState } from "react";
import { twMerge } from "tailwind-merge";

import Avatar from "~/components/Avatar";
import Button from "~/components/Button";
import LoadingSpinner from "~/components/LoadingSpinner";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { getAvatarUrl } from "~/utils/helpers";

type BoardRole = "viewer" | "editor" | "admin";

interface BoardAccessFormProps {
  boardPublicId: string;
  workspacePublicId: string;
}

export function BoardAccessForm({
  boardPublicId,
  workspacePublicId,
}: BoardAccessFormProps) {
  const { closeModal } = useModal();
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addRole, setAddRole] = useState<BoardRole>("editor");

  const { data, isLoading } = api.board.getMembers.useQuery({ boardPublicId });
  const { data: workspace } = api.workspace.byId.useQuery(
    { workspacePublicId },
    { enabled: workspacePublicId.length >= 12 },
  );

  const invalidate = () =>
    utils.board.getMembers.invalidate({ boardPublicId });

  const onError = (header: string) => (error: { message: string }) => {
    showPopup({ header, message: error.message, icon: "error" });
  };

  const setAccessLevel = api.board.setAccessLevel.useMutation({
    onSuccess: invalidate,
    onError: onError(t`Unable to update board access`),
  });
  const addMember = api.board.addMember.useMutation({
    onSuccess: async () => {
      await invalidate();
      setSelectedUserId("");
    },
    onError: onError(t`Unable to add board member`),
  });
  const updateMemberRole = api.board.updateMemberRole.useMutation({
    onSuccess: invalidate,
    onError: onError(t`Unable to update board member`),
  });
  const removeMember = api.board.removeMember.useMutation({
    onSuccess: invalidate,
    onError: onError(t`Unable to remove board member`),
  });

  const isRestricted = data?.accessLevel === "restricted";
  const boardMemberUserIds = new Set(
    data?.members.map((member) => member.user.id) ?? [],
  );
  const addableMembers = (workspace?.members ?? []).filter(
    (member) =>
      member.user?.id &&
      member.status === "active" &&
      !boardMemberUserIds.has(member.user.id),
  );

  return (
    <div className="p-5">
      <h2 className="pb-1 text-md font-medium text-neutral-900 dark:text-dark-1000">
        {t`Board access`}
      </h2>
      <p className="pb-4 text-sm text-light-900 dark:text-dark-900">
        {t`Choose who in the workspace can access this board.`}
      </p>

      {isLoading || !data ? (
        <div className="flex h-24 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {(["workspace", "restricted"] as const).map((level) => (
              <button
                key={level}
                type="button"
                disabled={setAccessLevel.isPending}
                onClick={() =>
                  data.accessLevel !== level &&
                  setAccessLevel.mutate({
                    boardPublicId,
                    accessLevel: level,
                  })
                }
                className={twMerge(
                  "flex-1 rounded-lg border p-3 text-left",
                  data.accessLevel === level
                    ? "border-light-1000 dark:border-dark-1000"
                    : "border-light-300 dark:border-dark-300",
                )}
              >
                <span className="block text-sm font-medium text-neutral-900 dark:text-dark-1000">
                  {level === "workspace" ? t`Workspace` : t`Restricted`}
                </span>
                <span className="block text-xs text-light-900 dark:text-dark-900">
                  {level === "workspace"
                    ? t`All workspace members`
                    : t`Only board members`}
                </span>
              </button>
            ))}
          </div>

          {isRestricted && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-medium text-neutral-900 dark:text-dark-1000">
                {t`Board members`}
              </h3>
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {data.members.length === 0 && (
                  <p className="text-sm text-light-900 dark:text-dark-900">
                    {t`No board members yet.`}
                  </p>
                )}
                {data.members.map((member) => (
                  <div
                    key={member.publicId}
                    className="flex items-center gap-2"
                  >
                    <Avatar
                      size="sm"
                      name={member.user.name ?? ""}
                      email={member.user.email}
                      imageUrl={
                        member.user.image
                          ? getAvatarUrl(member.user.image)
                          : undefined
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-900 dark:text-dark-1000">
                      {member.user.name ?? member.user.email}
                    </span>
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateMemberRole.mutate({
                          boardPublicId,
                          boardMemberPublicId: member.publicId,
                          role: e.target.value as BoardRole,
                        })
                      }
                      className="rounded-md border-0 bg-light-50 py-1 pl-2 pr-7 text-xs text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300"
                    >
                      <option value="viewer">{t`Viewer`}</option>
                      <option value="editor">{t`Editor`}</option>
                      <option value="admin">{t`Admin`}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        removeMember.mutate({
                          boardPublicId,
                          boardMemberPublicId: member.publicId,
                        })
                      }
                      className="text-xs text-light-900 hover:text-neutral-900 dark:text-dark-900 dark:hover:text-dark-1000"
                    >
                      {t`Remove`}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border-0 bg-light-50 py-1.5 pl-2 pr-7 text-sm text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300"
                >
                  <option value="">{t`Select a member…`}</option>
                  {addableMembers.map((member) => (
                    <option key={member.publicId} value={member.user?.id ?? ""}>
                      {member.user?.name ?? member.user?.email ?? member.email}
                    </option>
                  ))}
                </select>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as BoardRole)}
                  className="rounded-md border-0 bg-light-50 py-1.5 pl-2 pr-7 text-sm text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300"
                >
                  <option value="viewer">{t`Viewer`}</option>
                  <option value="editor">{t`Editor`}</option>
                  <option value="admin">{t`Admin`}</option>
                </select>
                <Button
                  onClick={() =>
                    selectedUserId &&
                    addMember.mutate({
                      boardPublicId,
                      userId: selectedUserId,
                      role: addRole,
                    })
                  }
                  isLoading={addMember.isPending}
                  disabled={!selectedUserId}
                >
                  {t`Add`}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button variant="secondary" onClick={() => closeModal()}>
              {t`Done`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
