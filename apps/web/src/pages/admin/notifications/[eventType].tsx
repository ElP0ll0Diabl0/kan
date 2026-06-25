import { useRouter } from "next/router";

import type { NextPageWithLayout } from "~/pages/_app";
import { AdminLayout } from "~/components/AdminLayout";
import { getDashboardLayout } from "~/components/Dashboard";
import { NotificationEditor } from "~/views/admin/NotificationEditor";
import { AdminGuard } from "~/views/admin/components/AdminGuard";
import type { NotificationEventType } from "~/views/admin/components/notificationEvents";
import { NOTIFICATION_EVENTS } from "~/views/admin/components/notificationEvents";

const VALID_EVENT_TYPES = new Set<string>(
  NOTIFICATION_EVENTS.map((e) => e.eventType),
);

const AdminNotificationEditorPage: NextPageWithLayout = () => {
  const router = useRouter();
  const raw = router.query.eventType;
  const eventType = Array.isArray(raw) ? raw[0] : raw;

  // Guard against arbitrary URL-shaped values: only render for events we know.
  // Anything else bounces back to the list rather than rendering an editor for
  // a missing event type and emitting confusing tRPC calls.
  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    if (typeof window !== "undefined" && router.isReady) {
      void router.replace("/admin/notifications");
    }
    return null;
  }

  return (
    <AdminGuard>
      <AdminLayout currentTab="notifications">
        <NotificationEditor eventType={eventType as NotificationEventType} />
      </AdminLayout>
    </AdminGuard>
  );
};

AdminNotificationEditorPage.getLayout = (page) => getDashboardLayout(page);

export default AdminNotificationEditorPage;
