import { DeleteLabelConfirmation } from "~/components/DeleteLabelConfirmation";
import FeedbackModal from "~/components/FeedbackModal";
import { LabelForm } from "~/components/LabelForm";
import Modal from "~/components/modal";
import { NewWorkspaceForm } from "~/components/NewWorkspaceForm";
import { EditYouTubeModal } from "~/components/YouTubeEmbed/EditYouTubeModal";
import { useModal } from "~/providers/modal";
import { DeleteCardConfirmation } from "./components/DeleteCardConfirmation";
import { DeleteChecklistConfirmation } from "./components/DeleteChecklistConfirmation";
import { DeleteCommentConfirmation } from "./components/DeleteCommentConfirmation";
import { NewChecklistForm } from "./components/NewChecklistForm";

/**
 * All card-scoped nested modals, rendered by the card popup (`CardModal`).
 *
 * These mirror the set the full-page card view renders inline. Because the
 * popup is mounted over the board — whose `renderModalContent` also renders
 * some of the same `modalContentType`s (labels, delete-card, YouTube,
 * workspace) — the board gates those with `!cardModalId` so only ONE instance
 * of any given modal is ever live. The popup owns them while it is open so they
 * get card-correct props (`cardPublicId`, `refetchCard`) instead of the board's
 * `entityId`/board refetch.
 */
export function CardNestedModals({
  cardPublicId,
  boardPublicId,
  refetchCard,
}: {
  cardPublicId: string;
  boardPublicId: string;
  refetchCard: () => Promise<void> | void;
}) {
  const { isOpen, modalContentType, entityId } = useModal();

  return (
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
        <LabelForm boardPublicId={boardPublicId} refetch={refetchCard} />
      </Modal>

      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "EDIT_LABEL"}
      >
        <LabelForm boardPublicId={boardPublicId} refetch={refetchCard} isEdit />
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
          boardPublicId={boardPublicId}
          cardPublicId={cardPublicId}
        />
      </Modal>

      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "DELETE_COMMENT"}
      >
        <DeleteCommentConfirmation
          cardPublicId={cardPublicId}
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
        <NewChecklistForm cardPublicId={cardPublicId} />
      </Modal>

      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "DELETE_CHECKLIST"}
      >
        <DeleteChecklistConfirmation
          cardPublicId={cardPublicId}
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
  );
}
