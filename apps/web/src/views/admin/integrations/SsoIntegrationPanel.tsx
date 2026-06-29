import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiOutlinePencilSquare, HiOutlineTrash } from "react-icons/hi2";

import Button from "~/components/Button";
import Input from "~/components/Input";
import LoadingSpinner from "~/components/LoadingSpinner";
import Toggle from "~/components/Toggle";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

interface FormState {
  publicId: string | null; // null = creating
  name: string;
  providerId: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  domain: string;
  enabled: boolean;
}

const emptyForm: FormState = {
  publicId: null,
  name: "",
  providerId: "",
  discoveryUrl: "",
  clientId: "",
  clientSecret: "",
  scopes: "",
  domain: "",
  enabled: true,
};

export function SsoIntegrationPanel() {
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const { data: connections, isLoading } = api.sso.list.useQuery();
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const onMutationError = (error: { message: string }) =>
    showPopup({
      header: t`Unable to save SSO connection`,
      message: error.message,
      icon: "error",
    });

  const invalidate = () => utils.sso.list.invalidate();

  const create = api.sso.create.useMutation({
    onSuccess: async () => {
      setForm(null);
      await invalidate();
    },
    onError: onMutationError,
  });
  const update = api.sso.update.useMutation({
    onSuccess: async () => {
      setForm(null);
      await invalidate();
    },
    onError: onMutationError,
  });
  const remove = api.sso.delete.useMutation({
    onSuccess: async () => {
      setConfirmDelete(null);
      await invalidate();
    },
    onError: onMutationError,
  });

  if (isLoading) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const onSave = () => {
    if (!form) return;
    if (form.publicId) {
      update.mutate({
        publicId: form.publicId,
        name: form.name.trim(),
        discoveryUrl: form.discoveryUrl.trim(),
        clientId: form.clientId.trim(),
        clientSecret: form.clientSecret ? form.clientSecret : undefined,
        scopes: form.scopes.trim() || undefined,
        domain: form.domain.trim() || undefined,
        enabled: form.enabled,
      });
    } else {
      create.mutate({
        name: form.name.trim(),
        providerId: form.providerId.trim(),
        discoveryUrl: form.discoveryUrl.trim(),
        clientId: form.clientId.trim(),
        clientSecret: form.clientSecret,
        scopes: form.scopes.trim() || undefined,
        domain: form.domain.trim() || undefined,
        enabled: form.enabled,
      });
    }
  };

  const callbackPreview = form?.providerId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/oauth2/callback/${form.providerId}`
    : "";

  return (
    <div className="space-y-6">
      <p className="text-sm text-light-900 dark:text-dark-900">
        {t`Add OIDC identity providers (Entra, Okta, Auth0, etc.). Connections take effect within ~30 seconds — no redeploy needed. The environment-configured OIDC provider, if any, continues to work alongside these.`}
      </p>

      {/* Existing connections */}
      {connections && connections.length > 0 && (
        <div className="overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5">
          <ul className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100">
            {connections.map((c) => (
              <li key={c.publicId} className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
                      {c.name}{" "}
                      <span className="text-xs font-normal text-light-900 dark:text-dark-900">
                        ({c.providerId})
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-light-900 dark:text-dark-900">
                      {c.discoveryUrl}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-light-900 dark:text-dark-900">
                        {t`Callback URL:`}
                      </span>
                      <code className="truncate rounded bg-light-200 px-1.5 py-0.5 text-xs text-light-1000 dark:bg-dark-200 dark:text-dark-1000">
                        {c.callbackUrl}
                      </code>
                      <button
                        type="button"
                        className="text-xs text-light-900 underline hover:text-light-1000 dark:text-dark-900 dark:hover:text-dark-1000"
                        onClick={() =>
                          void navigator.clipboard.writeText(c.callbackUrl)
                        }
                      >
                        {t`Copy`}
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Toggle
                      isChecked={c.enabled}
                      onChange={() =>
                        update.mutate({
                          publicId: c.publicId,
                          name: c.name,
                          discoveryUrl: c.discoveryUrl ?? "",
                          clientId: c.clientId ?? "",
                          scopes: c.scopes ?? undefined,
                          domain: c.domain ?? undefined,
                          enabled: !c.enabled,
                        })
                      }
                      label={t`Enabled`}
                      showLabel={false}
                    />
                    <button
                      type="button"
                      aria-label={t`Edit`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-light-900 hover:bg-light-200 hover:text-light-1000 dark:text-dark-900 dark:hover:bg-dark-200 dark:hover:text-dark-1000"
                      onClick={() =>
                        setForm({
                          publicId: c.publicId,
                          name: c.name,
                          providerId: c.providerId,
                          discoveryUrl: c.discoveryUrl ?? "",
                          clientId: c.clientId ?? "",
                          clientSecret: "",
                          scopes: c.scopes ?? "",
                          domain: c.domain ?? "",
                          enabled: c.enabled,
                        })
                      }
                    >
                      <HiOutlinePencilSquare />
                    </button>
                    {confirmDelete === c.publicId ? (
                      <Button
                        variant="danger"
                        isLoading={remove.isPending}
                        onClick={() => remove.mutate({ publicId: c.publicId })}
                      >
                        {t`Confirm`}
                      </Button>
                    ) : (
                      <button
                        type="button"
                        aria-label={t`Delete`}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setConfirmDelete(c.publicId)}
                      >
                        <HiOutlineTrash />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add / edit form */}
      {form ? (
        <section className="rounded-lg bg-light-50 p-6 shadow ring-1 ring-black ring-opacity-5 dark:bg-dark-100">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-dark-1000">
            {form.publicId ? t`Edit connection` : t`New OIDC connection`}
          </h3>
          <div className="grid gap-4 sm:max-w-lg">
            <Field label={t`Display name`}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t`e.g. Company Entra ID`}
              />
            </Field>
            <Field
              label={t`Provider id`}
              hint={t`Lowercase slug; used in the callback URL and cannot be changed later.`}
            >
              <Input
                value={form.providerId}
                onChange={(e) =>
                  setForm({ ...form, providerId: e.target.value })
                }
                disabled={!!form.publicId}
                placeholder="entra"
              />
            </Field>
            {callbackPreview && (
              <p className="-mt-2 text-xs text-light-900 dark:text-dark-900">
                {t`Register this redirect URI at your IdP:`}{" "}
                <code className="rounded bg-light-200 px-1 py-0.5 dark:bg-dark-200">
                  {callbackPreview}
                </code>
              </p>
            )}
            <Field label={t`OIDC discovery URL`}>
              <Input
                value={form.discoveryUrl}
                onChange={(e) =>
                  setForm({ ...form, discoveryUrl: e.target.value })
                }
                placeholder="https://login.microsoftonline.com/<tenant>/v2.0/.well-known/openid-configuration"
              />
            </Field>
            <Field label={t`Client ID`}>
              <Input
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              />
            </Field>
            <Field label={t`Client secret`}>
              <Input
                type="password"
                value={form.clientSecret}
                onChange={(e) =>
                  setForm({ ...form, clientSecret: e.target.value })
                }
                placeholder={
                  form.publicId
                    ? t`•••••••• (leave empty to keep current)`
                    : t`Enter the client secret`
                }
              />
            </Field>
            <Field
              label={t`Scopes`}
              hint={t`Comma-separated; defaults to openid,email,profile.`}
            >
              <Input
                value={form.scopes}
                onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                placeholder="openid,email,profile"
              />
            </Field>
            <Field label={t`Email domain (optional)`}>
              <Input
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="example.com"
              />
            </Field>
            <div className="flex items-center justify-between border-t border-light-600 pt-4 dark:border-dark-600">
              <span className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
                {t`Enabled`}
              </span>
              <Toggle
                isChecked={form.enabled}
                onChange={() => setForm({ ...form, enabled: !form.enabled })}
                label={t`Enabled`}
                showLabel={false}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onSave}
                isLoading={create.isPending || update.isPending}
              >
                {form.publicId ? t`Save changes` : t`Create connection`}
              </Button>
              <Button variant="secondary" onClick={() => setForm(null)}>
                {t`Cancel`}
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <Button variant="secondary" onClick={() => setForm({ ...emptyForm })}>
          {t`Add connection`}
        </Button>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-900 dark:text-dark-1000">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-light-900 dark:text-dark-900">
          {hint}
        </span>
      )}
    </label>
  );
}
