import { Dialog, Transition } from "@headlessui/react";
import { t } from "@lingui/core/macro";
import { Fragment, useEffect, useRef, useState } from "react";
import { HiXMark } from "react-icons/hi2";
import { IoChevronForwardSharp } from "react-icons/io5";

import Avatar from "~/components/Avatar";
import Editor from "~/components/Editor";
import LabelIcon from "~/components/LabelIcon";
import { useWorkspace } from "~/providers/workspace";
import { formatMemberDisplayName, getAvatarUrl } from "~/utils/helpers";
import ActivityList from "./components/ActivityList";
import { AttachmentThumbnails } from "./components/AttachmentThumbnails";
import { AttachmentUpload } from "./components/AttachmentUpload";
import Checklists from "./components/Checklists";
import CommentsList from "./components/CommentsList";
import Dropdown from "./components/Dropdown";
import { DueDateSelector } from "./components/DueDateSelector";
import LabelSelector from "./components/LabelSelector";
import ListSelector from "./components/ListSelector";
import MemberSelector from "./components/MemberSelector";
import NewCommentForm from "./components/NewCommentForm";
import { CardNestedModals } from "./CardNestedModals";
import { useCardEditor } from "./useCardEditor";

interface CardModalProps {
  cardPublicId: string;
  isTemplate?: boolean;
  onClose: () => void;
}

const metaLabelClass =
  "mb-1 text-xs font-medium text-light-900 dark:text-dark-900";

export default function CardModal({
  cardPublicId,
  isTemplate,
  onClose,
}: CardModalProps) {
  const { workspace } = useWorkspace();
  const {
    card,
    isLoading,
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
  } = useCardEditor(cardPublicId);

  const [activeTab, setActiveTab] = useState<"comments" | "activity">(
    "comments",
  );
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize the title textarea whenever the card content loads/changes
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [card]);

  const labels = board?.labels;
  const selectedLabels = card?.labels;
  const selectedMembers = card?.members;

  const formattedLabels =
    labels?.map((label) => ({
      key: label.publicId,
      value: label.name,
      selected:
        selectedLabels?.some((l) => l.publicId === label.publicId) ?? false,
      leftIcon: <LabelIcon colourCode={label.colourCode} />,
    })) ?? [];

  const formattedLists =
    board?.lists.map((list) => ({
      key: list.publicId,
      value: list.name,
      selected: list.publicId === card?.list.publicId,
    })) ?? [];

  const formattedMembers =
    workspaceMembers?.map((member) => ({
      key: member.publicId,
      value: formatMemberDisplayName(
        member.user?.name ?? null,
        member.user?.email ?? member.email,
      ),
      imageUrl: member.user?.image ? getAvatarUrl(member.user.image) : undefined,
      selected:
        selectedMembers?.some((m) => m.publicId === member.publicId) ?? false,
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
    })) ?? [];

  const ticketNumber =
    card?.cardNumber != null && card.list.board.workspace.cardPrefix
      ? `${card.list.board.workspace.cardPrefix}-${card.cardNumber}`
      : null;

  return (
    <>
      <Transition.Root show as={Fragment}>
        <Dialog as="div" className="relative z-40" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-light-50 bg-opacity-40 transition-opacity dark:bg-dark-50 dark:bg-opacity-40" />
        </Transition.Child>

        <div className="fixed inset-0 z-40 w-screen overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative mt-[5vh] flex h-[85vh] w-full max-w-[1040px] transform flex-col overflow-hidden rounded-lg border border-light-600 bg-white/95 text-left shadow-3xl-light backdrop-blur-[6px] transition-all dark:border-dark-600 dark:bg-dark-100/95 dark:shadow-3xl-dark">
                {/* Header strip */}
                <div className="flex w-full items-center justify-between border-b-[1px] border-light-300 px-6 py-2 dark:border-dark-300">
                  {!card && isLoading && (
                    <div className="h-[1.5rem] w-[150px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
                  )}
                  {card && (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="whitespace-nowrap text-sm font-bold text-light-900 dark:text-dark-950">
                          {board?.name}
                        </span>
                        {ticketNumber && (
                          <>
                            <IoChevronForwardSharp className="h-[10px] w-[10px] text-light-900 dark:text-dark-900" />
                            <span className="whitespace-nowrap text-sm font-bold leading-[1.5rem] text-light-700 dark:text-dark-800">
                              {ticketNumber}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Dropdown
                          cardPublicId={cardPublicId}
                          isTemplate={isTemplate}
                          boardPublicId={boardId}
                          cardCreatedBy={card.createdBy}
                          ticketNumber={ticketNumber}
                        />
                        <button
                          type="button"
                          onClick={onClose}
                          className="flex h-7 w-7 items-center justify-center rounded-[5px] text-light-900 hover:bg-light-200 dark:text-dark-900 dark:hover:bg-dark-200"
                          aria-label={t`Close`}
                        >
                          <HiXMark className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                  {!card && !isLoading && (
                    <p className="font-bold leading-[1.5rem] text-light-900 dark:text-dark-900">
                      {t`Card not found`}
                    </p>
                  )}
                </div>

                {/* Two-column body */}
                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  {/* Left: title + metadata + description + checklists + attachments */}
                  <div className="scrollbar-thumb-rounded-[4px] scrollbar-track-rounded-[4px] min-h-0 flex-1 overflow-y-auto p-6 scrollbar scrollbar-track-light-200 scrollbar-thumb-light-400 dark:scrollbar-track-dark-100 dark:scrollbar-thumb-dark-300 lg:border-r-[1px] lg:border-light-300 dark:lg:border-dark-300">
                    {!card && isLoading && (
                      <div className="h-[2.3rem] w-[300px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
                    )}
                    {card && (
                      <>
                        <form
                          onSubmit={handleSubmit(onSubmit)}
                          className="w-full"
                        >
                          <textarea
                            id="card-modal-title"
                            {...register("title")}
                            ref={(el) => {
                              register("title").ref(el);
                              titleRef.current = el;
                            }}
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
                        </form>

                        {/* Inline metadata row (Trello-style) */}
                        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                          <div className="flex flex-col">
                            <span className={metaLabelClass}>{t`List`}</span>
                            <ListSelector
                              cardPublicId={cardPublicId}
                              lists={formattedLists}
                              isLoading={!card}
                              disabled={!canEdit}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className={metaLabelClass}>{t`Labels`}</span>
                            <LabelSelector
                              cardPublicId={cardPublicId}
                              labels={formattedLabels}
                              isLoading={!card}
                              disabled={!canEdit}
                            />
                          </div>
                          {!isTemplate && (
                            <div className="flex flex-col">
                              <span className={metaLabelClass}>
                                {t`Members`}
                              </span>
                              <MemberSelector
                                cardPublicId={cardPublicId}
                                members={formattedMembers}
                                isLoading={!card}
                                disabled={!canEdit}
                              />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className={metaLabelClass}>{t`Due date`}</span>
                            <DueDateSelector
                              cardPublicId={cardPublicId}
                              dueDate={card.dueDate}
                              isLoading={!card}
                              disabled={!canEdit}
                            />
                          </div>
                        </div>

                        <div className="mt-6">
                          <Editor
                            content={card.description}
                            onChange={
                              canEdit ? (e) => setValue("description", e) : undefined
                            }
                            onBlur={
                              canEdit ? () => handleSubmit(onSubmit)() : undefined
                            }
                            workspaceMembers={workspaceMembers ?? []}
                            readOnly={!canEdit}
                          />
                        </div>

                        <div className="mt-8">
                          <Checklists
                            checklists={card.checklists}
                            cardPublicId={cardPublicId}
                            workspaceMembers={
                              isTemplate ? undefined : workspaceMembers
                            }
                            activeChecklistForm={activeChecklistForm}
                            setActiveChecklistForm={setActiveChecklistForm}
                            viewOnly={!canEdit}
                          />
                        </div>

                        {!isTemplate && (
                          <>
                            {card.attachments.length > 0 && (
                              <div className="mt-6">
                                <AttachmentThumbnails
                                  attachments={card.attachments}
                                  cardPublicId={cardPublicId}
                                  isReadOnly={!canEdit}
                                />
                              </div>
                            )}
                            {canEdit && (
                              <div className="mt-6">
                                <AttachmentUpload cardPublicId={cardPublicId} />
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right: Comments / Activity */}
                  {card && (
                    <div className="scrollbar-thumb-rounded-[4px] scrollbar-track-rounded-[4px] flex min-h-0 flex-col overflow-y-auto p-6 scrollbar scrollbar-track-light-200 scrollbar-thumb-light-400 dark:scrollbar-track-dark-100 dark:scrollbar-thumb-dark-300 lg:w-[380px] lg:flex-shrink-0">
                      {isTemplate ? (
                        <>
                          <h2 className="text-md pb-4 font-medium text-light-1000 dark:text-dark-1000">
                            {t`Activity`}
                          </h2>
                          <ActivityList
                            cardPublicId={cardPublicId}
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
                                cardPublicId={cardPublicId}
                                isLoading={!card}
                              />
                              <div className="mt-6">
                                <NewCommentForm
                                  cardPublicId={cardPublicId}
                                  workspaceMembers={editorWorkspaceMembers}
                                />
                              </div>
                            </>
                          ) : (
                            <ActivityList
                              cardPublicId={cardPublicId}
                              isLoading={!card}
                              isAdmin={workspace.role === "admin"}
                              filter="activity"
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
        </Dialog>
      </Transition.Root>
      <CardNestedModals
        cardPublicId={cardPublicId}
        boardPublicId={boardId ?? ""}
        refetchCard={refetchCard}
      />
    </>
  );
}
