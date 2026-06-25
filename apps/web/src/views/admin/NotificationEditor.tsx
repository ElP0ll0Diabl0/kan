import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { HiOutlineChevronDown, HiOutlineArrowLeft } from "react-icons/hi2";

import { EVENT_PLACEHOLDERS } from "@kan/api/utils/notificationPlaceholders";

import Button from "~/components/Button";
import Editor from "~/components/Editor";
import LoadingSpinner from "~/components/LoadingSpinner";
import { PageHead } from "~/components/PageHead";
import Toggle from "~/components/Toggle";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import type { NotificationEventType } from "./components/notificationEvents";
import { NOTIFICATION_EVENTS } from "./components/notificationEvents";

interface NotificationEditorProps {
  eventType: NotificationEventType;
}

/**
 * Per-event editor for the notification subject + body.
 *
 * Replicates the Freshservice email-notifications editor pattern:
 * - editable Subject
 * - Tiptap-backed Body with an "Insert Placeholders" dropdown
 * - Notification on/off toggle in the header
 *
 * Save / Cancel actions write the entire rule (enabled + subject + body) in
 * one upsert. Leaving the body empty falls back to the per-event built-in
 * react-email template — same fallback semantics as customSubject.
 */
export function NotificationEditor({ eventType }: NotificationEditorProps) {
  const router = useRouter();
  const { i18n } = useLingui();
  const { showPopup } = usePopup();
  const utils = api.useUtils();

  const meta = NOTIFICATION_EVENTS.find((e) => e.eventType === eventType);
  const placeholders = EVENT_PLACEHOLDERS[eventType] ?? [];

  // We rely on the existing list query so we never need to add a new
  // "get one" endpoint. It's already prefetched on the parent /admin/notifications
  // page, so this typically resolves from cache.
  const { data, isLoading } = api.admin.listGlobalNotificationRules.useQuery();
  const rule = useMemo(
    () => data?.find((r) => r.eventType === eventType),
    [data, eventType],
  );

  const [enabled, setEnabled] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [placeholderMenuOpen, setPlaceholderMenuOpen] = useState(false);

  // Seed once the rule lands. Re-seed when eventType changes (the same page
  // component is reused across routes via Next.js's shallow nav).
  useEffect(() => {
    if (!rule) return;
    setEnabled(rule.enabled);
    setSubject(rule.customSubject ?? "");
    setBody(rule.customBody ?? "");
  }, [rule]);

  const upsert = api.admin.upsertGlobalNotificationRule.useMutation({
    onSuccess: async () => {
      await utils.admin.listGlobalNotificationRules.invalidate();
      showPopup({
        header: t`Notification saved`,
        message: t`Your changes have been saved.`,
        icon: "success",
      });
      void router.push("/admin/notifications");
    },
    onError: (error) => {
      showPopup({
        header: t`Unable to save notification`,
        message: error.message,
        icon: "error",
      });
    },
  });

  if (!meta) {
    return (
      <div className="text-sm text-light-900 dark:text-dark-900">
        {t`Unknown notification event.`}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const handleSave = () => {
    upsert.mutate({
      eventType,
      enabled,
      customSubject: subject.trim() ? subject.trim() : null,
      customBody: body.trim() ? body : null,
    });
  };

  const insertPlaceholder = (key: string) => {
    setPlaceholderMenuOpen(false);
    // Prefer cursor insertion via the Tiptap instance; fall back to appending
    // if the editor isn't mounted yet (e.g. very fast click after navigation).
    if (editor) {
      editor.chain().focus().insertContent(`{{${key}}}`).run();
    } else {
      setBody((prev) => `${prev}{{${key}}}`);
    }
  };

  return (
    <>
      <PageHead title={t`Admin | Notifications | ${i18n._(meta.label)}`} />

      {/* Header bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push("/admin/notifications")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-light-600 text-light-900 hover:bg-light-200 dark:border-dark-400 dark:text-dark-900 dark:hover:bg-dark-200"
            aria-label={t`Back to notifications`}
          >
            <HiOutlineArrowLeft />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-neutral-900 dark:text-dark-1000">
              {i18n._(meta.label)}
            </h1>
            <p className="truncate text-xs text-light-900 dark:text-dark-900">
              {i18n._(meta.description)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Toggle
            isChecked={enabled}
            onChange={() => setEnabled((v) => !v)}
            label={t`Notification enabled`}
            showLabel={false}
          />
          <Button
            variant="secondary"
            onClick={() => router.push("/admin/notifications")}
          >
            {t`Cancel`}
          </Button>
          <Button onClick={handleSave} isLoading={upsert.isPending}>
            {t`Save`}
          </Button>
        </div>
      </div>

      {/* Subject */}
      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-light-1000 dark:text-dark-1000">
          {t`Subject`}
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t`Default subject`}
          className="w-full rounded-lg border-0 bg-light-50 py-2 px-3 text-sm text-light-1000 ring-1 ring-inset ring-light-300 focus:ring-2 focus:ring-inset focus:ring-light-400 dark:bg-dark-50 dark:text-dark-1000 dark:ring-dark-300 dark:focus:ring-dark-500"
        />
        <p className="mt-1 text-xs text-light-900 dark:text-dark-900">
          {t`Leave blank to fall back to the built-in subject.`}
        </p>
      </div>

      {/* Body */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-light-1000 dark:text-dark-1000">
            {t`Message`}
          </label>

          {/* Insert Placeholders dropdown */}
          {placeholders.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPlaceholderMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-light-600 px-3 py-1.5 text-xs font-medium text-light-1000 hover:bg-light-200 dark:border-dark-400 dark:text-dark-1000 dark:hover:bg-dark-200"
              >
                {t`Insert Placeholders`}
                <HiOutlineChevronDown className="h-3 w-3" />
              </button>
              {placeholderMenuOpen && (
                <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-light-600 bg-light-50 py-1 shadow-lg dark:border-dark-400 dark:bg-dark-100">
                  {placeholders.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => insertPlaceholder(p.key)}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-light-200 dark:hover:bg-dark-200"
                    >
                      <span className="text-light-1000 dark:text-dark-1000">
                        {p.label}
                      </span>
                      <span className="font-mono text-light-900 dark:text-dark-900">
                        {`{{${p.key}}}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-light-600 bg-light-50 dark:border-dark-400 dark:bg-dark-100">
          <Editor
            content={body}
            onChange={setBody}
            onEditorReady={setEditor}
            workspaceMembers={[]}
            enableYouTubeEmbed={false}
            placeholder={t`Write the message body here. Insert placeholders from the dropdown above.`}
          />
        </div>
        <p className="mt-1 text-xs text-light-900 dark:text-dark-900">
          {t`Leave blank to fall back to the built-in template. Placeholders like {{actorName}} are replaced when the email is sent.`}
        </p>
      </div>
    </>
  );
}
