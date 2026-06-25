import { t } from "@lingui/core/macro";

import Button from "~/components/Button";
import Modal from "~/components/modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}

/** Generic confirmation modal for admin actions, driven by local state. */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  isLoading,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal modalSize="sm" isVisible={isOpen} closeOnClickOutside={false}>
      <div className="p-5">
        <h2 className="text-md pb-4 font-medium text-neutral-900 dark:text-dark-1000">
          {title}
        </h2>
        {message && (
          <p className="text-sm text-light-900 dark:text-dark-900">{message}</p>
        )}
        {children}
        <div className="mt-6 flex justify-end space-x-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {t`Cancel`}
          </Button>
          <Button onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
