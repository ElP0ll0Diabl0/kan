import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { authClient } from "@kan/auth/client";

import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

export interface CardFormValues {
  cardId: string;
  title: string;
  description: string;
}

/**
 * Shared card-editing logic used by both the full-page card view
 * (`views/card/index.tsx`) and the Trello-style popup (`views/card/CardModal.tsx`).
 *
 * Pass the card's public id explicitly (the modal reads it from `?card=`, the
 * full page from `router.query.cardId`) so the same logic works in both contexts.
 */
export function useCardEditor(cardPublicId: string | undefined) {
  const utils = api.useUtils();
  const { showPopup } = usePopup();
  const { canEditCard } = usePermissions();
  const { data: session } = authClient.useSession();
  const { modalStates, getModalState, clearModalState } = useModal();

  const [activeChecklistForm, setActiveChecklistForm] = useState<string | null>(
    null,
  );

  const cardId = cardPublicId;

  const {
    data: card,
    isLoading,
    error,
  } = api.card.byId.useQuery(
    { cardPublicId: cardId ?? "" },
    { enabled: !!cardId && cardId.length >= 12 },
  );

  const isCreator = card?.createdBy && session?.user.id === card.createdBy;
  const canEdit = canEditCard || isCreator;

  const board = card?.list.board;
  const boardId = board?.publicId;
  const workspaceMembers = board?.workspace.members;

  const editorWorkspaceMembers =
    workspaceMembers
      ?.filter((member) => member.email)
      .map((member) => ({
        publicId: member.publicId,
        email: member.email,
        user: member.user
          ? {
              id: member.user.id,
              name: member.user.name ?? null,
              image: member.user.image ?? null,
            }
          : null,
      })) ?? [];

  const refetchCard = async () => {
    if (cardId) await utils.card.byId.refetch({ cardPublicId: cardId });
  };

  const updateCard = api.card.update.useMutation({
    onError: () => {
      showPopup({
        header: t`Unable to update card`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      if (cardId) await invalidateCard(utils, cardId);
    },
  });

  const addOrRemoveLabel = api.card.addOrRemoveLabel.useMutation({
    onError: () => {
      showPopup({
        header: t`Unable to add label`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      if (cardId) {
        await utils.card.byId.invalidate({ cardPublicId: cardId });
      }
    },
  });

  const form = useForm<CardFormValues>({
    values: {
      cardId: cardId ?? "",
      title: card?.title ?? "",
      description: card?.description ?? "",
    },
  });

  const onSubmit = (values: CardFormValues) => {
    updateCard.mutate({
      cardPublicId: values.cardId,
      title: values.title,
      description: values.description,
    });
  };

  // Add a newly created label to the card's selected labels
  useEffect(() => {
    const newLabelId = modalStates.NEW_LABEL_CREATED;
    if (newLabelId && cardId) {
      const isAlreadyAdded = card?.labels.some(
        (label) => label.publicId === newLabelId,
      );

      if (!isAlreadyAdded) {
        addOrRemoveLabel.mutate({
          cardPublicId: cardId,
          labelPublicId: newLabelId,
        });
      }
      clearModalState("NEW_LABEL_CREATED");
    }
  }, [modalStates.NEW_LABEL_CREATED, card, cardId]);

  // Open the new item form after creating a new checklist
  useEffect(() => {
    if (!card) return;
    const state = getModalState("ADD_CHECKLIST");
    const createdId: string | undefined = state?.createdChecklistId;
    if (createdId) {
      setActiveChecklistForm(createdId);
      clearModalState("ADD_CHECKLIST");
    }
  }, [card, getModalState, clearModalState]);

  return {
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
    register: form.register,
    handleSubmit: form.handleSubmit,
    setValue: form.setValue,
    watch: form.watch,
  };
}
