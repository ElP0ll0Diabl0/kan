import Link from "next/link";
import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";
import { HiXMark } from "react-icons/hi2";
import { IoChevronForwardSharp } from "react-icons/io5";

import { authClient } from "@kan/auth/client";

import Avatar from "~/components/Avatar";
import Editor from "~/components/Editor";
import FeedbackModal from "~/components/FeedbackModal";
import { LabelForm } from "~/components/LabelForm";
import LabelIcon from "~/components/LabelIcon";
import Modal from "~/components/modal";
import { NewWorkspaceForm } from "~/components/NewWorkspaceForm";
import { PageHead } from "~/components/PageHead";
import { EditYouTubeModal } from "~/components/YouTubeEmbed/EditYouTubeModal";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import { formatMemberDisplayName, getAvatarUrl } from "~/utils/helpers";
import { DeleteLabelConfirmation } from "../../components/DeleteLabelConfirmation";
import ActivityList from "./components/ActivityList";
import { AttachmentThumbnails } from "./components/AttachmentThumbnails";
import { AttachmentUpload } from "./components/AttachmentUpload";
import Checklists from "./components/Checklists";
import CommentsList from "./components/CommentsList";
import { DeleteCardConfirmation } from "./components/DeleteCardConfirmation";
import { DeleteChecklistConfirmation } from "./components/DeleteChecklistConfirmation";
import { DeleteCommentConfirmation } from "./components/DeleteCommentConfirmation";
import Dropdown from "./components/Dropdown";
import { DueDateSelector } from "./components/DueDateSelector";
import LabelSelector from "./components/LabelSelector";
import ListSelector from "./components/ListSelector";
import MemberSelector from "./components/MemberSelector";
import { NewChecklistForm } from "./components/NewChecklistForm";
import NewCommentForm from "./components/NewCommentForm";
import { useCardEditor } from "./useCardEditor";

export function CardRightPanel({ isTemplate }: { isTemplate?: boolean }) {
  const router = useRouter();
  const { canEditCard } = usePermissions();
  const { data: session } = authClient.useSession();
  const cardId = Array.isArray(router.query.cardId)
    ? router.query.cardId[0]
    : router.query.cardId;

  const { data: card } = api.card.byId.useQuery(
    { cardPublicId: cardId ?? "" },
    { enabled: !!cardId && cardId.length >= 12 },
  );

  const isCreator = card?.createdBy && session?.user.id === card.createdBy;
  const canEdit = canEditCard || isCreator;

  const board = card?.list.board;
  const labels = board?.labels;
  const workspaceMembers = board?.workspace.members;
  const selectedLabels = card?.labels;
  const selectedMembers = card?.members;

  const formattedLabels =
    labels?.map((label) => {
      const isSelected = selectedLabels?.some(
        (selectedLabel) => selectedLabel.publicId === label.publicId,
      );

      return {
        key: label.publicId,
        value: label.name,
        selected: isSelected ?? false,
        leftIcon: <LabelIcon colourCode={label.colourCode} />,
      };
    }) ?? [];

  const formattedLists =
    board?.lists.map((list) => ({
      key: list.publicId,
      value: list.name,
      selected: list.publicId === card?.list.publicId,
    })) ?? [];

  const formattedMembers =
    workspaceMembers?.map((member) => {
      const isSelected = selectedMembers?.some(
        (assignedMember) => assignedMember.publicId === member.publicId,
      );

      return {
        key: member.publicId,
        value: formatMemberDisplayName(
          member.user?.name ?? null,
          member.user?.email ?? member.email,
        ),
        imageUrl: member.user?.image
          ? getAvatarUrl(member.user.image)
          : undefined,
        selected: isSelected ?? false,
        leftIcon: (
          <Avatar
            size="xs"
            name={member.user?.name ?? ""}
            imageUrl={
              member.user?.image ? getAvatarUrl(member.user.image) : undefined
            }
            email={member.user?.email ?? member.email}
          />
        ),
      };
    }) ?? [];

  return (
    <div className="h-full w-[360px] border-l-[1px] border-light-300 bg-light-50 p-8 text-light-900 dark:border-dark-300 dark:bg-dark-50 dark:text-dark-900">
      <div className="mb-4 flex w-full flex-row pt-[18px]">
        <p className="my-2 mb-2 w-[100px] text-sm font-medium">{t`List`}</p>
        <ListSelector
          cardPublicId={cardId ?? ""}
          lists={formattedLists}
          isLoading={!card}
          disabled={!canEdit}
        />
      </div>
      <div className="mb-4 flex w-full flex-row">
        <p className="my-2 mb-2 w-[100px] text-sm font-medium">{t`Labels`}</p>
        <LabelSelector
          cardPublicId={cardId ?? ""}
          labels={formattedLabels}
          isLoading={!card}
          disabled={!canEdit}
        />
      </div>
      {!isTemplate && (
        <div className="mb-4 flex w-full flex-row">
          <p className="my-2 mb-2 w-[100px] text-sm font-medium">{t`Members`}</p>
          <MemberSelector
            cardPublicId={cardId ?? ""}
            members={formattedMembers}
            isLoading={!card}
            disabled={!canEdit}
          />
        </div>
      )}
      <div className="mb-4 flex w-full flex-row">
        <p className="my-2 mb-2 w-[100px] text-sm font-medium">{t`Due date`}</p>
        <DueDateSelector
          cardPublicId={cardId ?? ""}
          dueDate={card?.dueDate}
          isLoading={!card}
          disabled={!canEdit}
        />
      </div>
    </div>
  );
}

export default function CardPage({ isTemplate }: { isTemplate?: boolean }) {
  const router = useRouter();
  const { modalContentType, entityId, isOpen } = useModal();
  const { workspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"comments" | "activity">(
    "comments",
  );

  const cardId = Array.isArray(router.query.cardId)
    ? router.query.cardId[0]
    : router.query.cardId;

  const {
    card,
    isLoading,
    error,
    canEdit,
    boardId,
    board,
    workspaceMembers,
    editorWorkspaceMembers,
    refetchCard,
    onSubmit,
    activeChecklistForm,
    setActiveChecklistForm,
    register,
    handleSubmit,
    setValue,
  } = useCardEditor(cardId);

  // Redirect to 404 if card doesn't exist
  useEffect(() => {
    if (router.isReady && cardId && !isLoading) {
      if (error?.data?.code === "NOT_FOUND" || (!card && !isLoading)) {
        router.replace("/404");
      }
    }
  }, [router, cardId, isLoading, error, card]);

  // Auto-resize title textarea
  useEffect(() => {
    const titleTextarea = document.getElementById(
      "title",
    ) as HTMLTextAreaElement;
    if (titleTextarea) {
      titleTextarea.style.height = "auto";
      titleTextarea.style.height = `${titleTextarea.scrollHeight}px`;
    }
  }, [card]);

  if (!cardId) return <></>;

  return (
    <>
      <PageHead
        title={t`${card?.title ?? t`Card`} | ${board?.name ?? t`Board`}`}
      />
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Full-width top strip with board link and dropdown */}
        <div className="flex w-full items-center justify-between border-b-[1px] border-light-300 bg-light-50 px-8 py-2 dark:border-dark-300 dark:bg-dark-50">
          {!card && isLoading && (
            <div className="flex space-x-2">
              <div className="h-[1.5rem] w-[150px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
            </div>
          )}
          {card && (
            <>
              <div className="flex items-center gap-1">
                <Link
                  className="whitespace-nowrapleading-[1.5rem] text-sm font-bold text-light-900 dark:text-dark-950"
                  href={`${isTemplate ? "/templates" : "/boards"}`}
                >
                  {workspace.name}
                </Link>
                <IoChevronForwardSharp className="h-[10px] w-[10px] text-light-900 dark:text-dark-900" />
                <Link
                  className="whitespace-nowrap text-sm font-bold leading-[1.5rem] text-light-900 dark:text-dark-950"
                  href={`${isTemplate ? "/templates" : "/boards"}/${board?.publicId}`}
                >
                  {board?.name}
                </Link>
                {card.cardNumber != null && card.list.board.workspace.cardPrefix && (
                  <>
                    <IoChevronForwardSharp className="h-[10px] w-[10px] text-light-900 dark:text-dark-900" />
                    <span className="whitespace-nowrap text-sm font-bold leading-[1.5rem] text-light-700 dark:text-dark-800">
                      {card.list.board.workspace.cardPrefix}-{card.cardNumber}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Dropdown
                  cardPublicId={cardId}
                  isTemplate={isTemplate}
                  boardPublicId={boardId}
                  cardCreatedBy={card?.createdBy}
                  ticketNumber={
                    card.cardNumber != null && card.list.board.workspace.cardPrefix
                      ? `${card.list.board.workspace.cardPrefix}-${card.cardNumber}`
                      : null
                  }
                />
                <Link
                  href={`/${isTemplate ? "templates" : "boards"}/${boardId}`}
                  className="flex h-7 w-7 items-center justify-center rounded-[5px] text-light-900 hover:bg-light-200 dark:text-dark-900 dark:hover:bg-dark-200"
                  aria-label={t`Close`}
                >
                  <HiXMark className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
          {!card && !isLoading && (
            <p className="block p-0 py-0 font-bold leading-[1.5rem] tracking-tight text-light-900 dark:text-dark-900 sm:text-[1rem]">
              {t`Card not found`}
            </p>
          )}
        </div>
        <div className="scrollbar-thumb-rounded-[4px] scrollbar-track-rounded-[4px] w-full flex-1 overflow-y-auto scrollbar scrollbar-track-light-200 scrollbar-thumb-light-400 hover:scrollbar-thumb-light-400 dark:scrollbar-track-dark-100 dark:scrollbar-thumb-dark-300 dark:hover:scrollbar-thumb-dark-300">
          <div className="p-auto mx-auto flex h-full w-full max-w-[800px] flex-col">
            <div className="p-6 md:p-8">
              <div className="mb-8 md:mt-4">
                {!card && isLoading && (
                  <div className="flex space-x-2">
                    <div className="h-[2.3rem] w-[300px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
                  </div>
                )}
                {card && (
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="w-full space-y-6"
                  >
                    <div>
                      <textarea
                        id="title"
                        {...register("title")}
                        onBlur={canEdit ? handleSubmit(onSubmit) : undefined}
                        rows={1}
                        disabled={!canEdit}
                        className={`block w-full resize-none overflow-hidden border-0 bg-transparent p-0 py-0 font-bold leading-relaxed text-neutral-900 focus:ring-0 dark:text-dark-1000 sm:text-[1.2rem] ${!canEdit ? "cursor-default" : ""}`}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = "auto";
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    </div>
                  </form>
                )}
                {!card && !isLoading && (
                  <p className="block p-0 py-0 font-bold leading-[2.3rem] tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
                    {t`Card not found`}
                  </p>
                )}
              </div>
              {card && (
                <>
                  <div className="mb-10 flex w-full max-w-2xl flex-col justify-between">
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="w-full space-y-6"
                    >
                      <div className="mt-2">
                        <Editor
                          content={card.description}
                          onChange={
                            canEdit
                              ? (e) => setValue("description", e)
                              : undefined
                          }
                          onBlur={
                            canEdit ? () => handleSubmit(onSubmit)() : undefined
                          }
                          workspaceMembers={workspaceMembers ?? []}
                          readOnly={!canEdit}
                        />
                      </div>
                    </form>
                  </div>
                  <Checklists
                    checklists={card.checklists}
                    cardPublicId={cardId}
                    workspaceMembers={isTemplate ? undefined : workspaceMembers}
                    activeChecklistForm={activeChecklistForm}
                    setActiveChecklistForm={setActiveChecklistForm}
                    viewOnly={!canEdit}
                  />
                  {!isTemplate && (
                    <>
                      {card?.attachments.length > 0 && (
                        <div className="mt-6">
                          <AttachmentThumbnails
                            attachments={card.attachments}
                            cardPublicId={cardId ?? ""}
                            isReadOnly={!canEdit}
                          />
                        </div>
                      )}
                      {canEdit && (
                        <div className="mt-6">
                          <AttachmentUpload cardPublicId={cardId} />
                        </div>
                      )}
                    </>
                  )}
                  <div className="border-t-[1px] border-light-300 pt-12 dark:border-dark-300">
                    {isTemplate ? (
                      <>
                        <h2 className="text-md pb-4 font-medium text-light-1000 dark:text-dark-1000">
                          {t`Activity`}
                        </h2>
                        <ActivityList
                          cardPublicId={cardId}
                          isLoading={!card}
                          isAdmin={workspace.role === "admin"}
                          filter="activity"
                        />
                      </>
                    ) : (
                      <>
                        <div className="flex border-b-[1px] border-light-300 dark:border-dark-300">
                          {(
                            [
                              { key: "comments", label: t`Comments` },
                              { key: "activity", label: t`Activity` },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setActiveTab(tab.key)}
                              className={`-mb-px flex-1 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors focus:outline-none ${
                                activeTab === tab.key
                                  ? "border-light-1000 text-light-1000 dark:border-dark-1000 dark:text-dark-1000"
                                  : "border-transparent text-light-900 hover:border-light-950 hover:text-light-950 dark:text-dark-900 dark:hover:border-white/20 dark:hover:text-dark-950"
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        {activeTab === "comments" ? (
                          <>
                            <CommentsList
                              cardPublicId={cardId}
                              isLoading={!card}
                            />
                            <div className="mt-6">
                              <NewCommentForm
                                cardPublicId={cardId}
                                workspaceMembers={editorWorkspaceMembers}
                              />
                            </div>
                          </>
                        ) : (
                          <ActivityList
                            cardPublicId={cardId}
                            isLoading={!card}
                            isAdmin={workspace.role === "admin"}
                            filter="activity"
                          />
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <>
          <Modal
            modalSize="md"
            isVisible={isOpen && modalContentType === "NEW_FEEDBACK"}
          >
            <FeedbackModal />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "NEW_LABEL"}
          >
            <LabelForm boardPublicId={boardId ?? ""} refetch={refetchCard} />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "EDIT_LABEL"}
          >
            <LabelForm
              boardPublicId={boardId ?? ""}
              refetch={refetchCard}
              isEdit
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_LABEL"}
          >
            <DeleteLabelConfirmation
              refetch={refetchCard}
              labelPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_CARD"}
          >
            <DeleteCardConfirmation
              boardPublicId={boardId ?? ""}
              cardPublicId={cardId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_COMMENT"}
          >
            <DeleteCommentConfirmation
              cardPublicId={cardId}
              commentPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "NEW_WORKSPACE"}
          >
            <NewWorkspaceForm />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "ADD_CHECKLIST"}
          >
            <NewChecklistForm cardPublicId={cardId} />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_CHECKLIST"}
          >
            <DeleteChecklistConfirmation
              cardPublicId={cardId}
              checklistPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "EDIT_YOUTUBE"}
          >
            <EditYouTubeModal />
          </Modal>
        </>
      </div>
    </>
  );
}
