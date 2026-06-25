import { t } from "@lingui/core/macro";
import { env } from "next-runtime-env";
import { useState } from "react";

import Button from "~/components/Button";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { ConfirmDialog } from "./ConfirmDialog";

interface MemberSecuritySectionProps {
  userId: string;
  email: string;
}

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Generates a random 16-character password using a cryptographic source. */
const generatePassword = () => {
  const length = 16;
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  return Array.from(
    values,
    (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length],
  ).join("");
};

const inputClasses =
  "w-full rounded-lg border-0 bg-light-50 px-3 py-2 text-sm text-light-1000 ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300";

/** Admin password controls: email a reset link or set a temporary password. */
export function MemberSecuritySection({
  userId,
  email,
}: MemberSecuritySectionProps) {
  const { showPopup } = usePopup();
  const credentialsEnabled =
    env("NEXT_PUBLIC_ALLOW_CREDENTIALS")?.toLowerCase() === "true";

  const [isTempOpen, setIsTempOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  const sendReset = api.admin.sendPasswordReset.useMutation({
    onSuccess: () => {
      showPopup({
        header: t`Reset email sent`,
        message: t`A password reset link has been emailed to ${email}.`,
        icon: "success",
      });
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to send reset email`,
        message: error.message,
        icon: "error",
      });
    },
  });

  const setUserPassword = api.admin.setUserPassword.useMutation({
    onSuccess: () => {
      showPopup({
        header: t`Password set`,
        message: t`The temporary password is now active. Share it securely with the user.`,
        icon: "success",
      });
      setIsTempOpen(false);
      setTempPassword("");
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to set password`,
        message: error.message,
        icon: "error",
      });
    },
  });

  const closeTemp = () => {
    setIsTempOpen(false);
    setTempPassword("");
  };

  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      showPopup({
        header: t`Copied`,
        message: t`Password copied to clipboard.`,
        icon: "success",
      });
    } catch {
      // Clipboard may be unavailable (e.g. non-secure context); ignore.
    }
  };

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-dark-1000">
        {t`Password & security`}
      </h3>
      <p className="mb-3 text-xs text-light-900 dark:text-dark-900">
        {credentialsEnabled
          ? t`Email a password reset link or set a temporary password for this user.`
          : t`Password authentication is disabled on this instance (NEXT_PUBLIC_ALLOW_CREDENTIALS).`}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!credentialsEnabled || sendReset.isPending}
          isLoading={sendReset.isPending}
          onClick={() => sendReset.mutate({ userId })}
        >
          {t`Send reset email`}
        </Button>
        <Button
          variant="secondary"
          disabled={!credentialsEnabled}
          onClick={() => {
            setTempPassword(generatePassword());
            setIsTempOpen(true);
          }}
        >
          {t`Set temporary password`}
        </Button>
      </div>

      {isTempOpen && (
        <ConfirmDialog
          isOpen
          title={t`Set a temporary password`}
          message={t`This immediately sets the user's password. Share it securely — they can change it later in Settings.`}
          confirmLabel={t`Set password`}
          isLoading={setUserPassword.isPending}
          onConfirm={() => {
            if (tempPassword.length < 8) return;
            setUserPassword.mutate({ userId, newPassword: tempPassword });
          }}
          onClose={closeTemp}
        >
          <div className="mt-3">
            <label className="block text-xs text-light-900 dark:text-dark-900">
              {t`Temporary password`}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className={inputClasses}
              />
              <Button
                variant="secondary"
                type="button"
                onClick={() => setTempPassword(generatePassword())}
              >
                {t`Generate`}
              </Button>
              <Button variant="secondary" type="button" onClick={copyTempPassword}>
                {t`Copy`}
              </Button>
            </div>
            {tempPassword.length < 8 && (
              <p className="mt-2 text-xs text-red-400">
                {t`Password must be at least 8 characters.`}
              </p>
            )}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
