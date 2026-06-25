import type { NextPageWithLayout } from "~/pages/_app";
import { AdminLayout } from "~/components/AdminLayout";
import { getDashboardLayout } from "~/components/Dashboard";
import { NotificationRules } from "~/views/admin/NotificationRules";
import { AdminGuard } from "~/views/admin/components/AdminGuard";

const AdminNotificationsPage: NextPageWithLayout = () => {
  return (
    <AdminGuard>
      <AdminLayout currentTab="notifications">
        <NotificationRules />
      </AdminLayout>
    </AdminGuard>
  );
};

AdminNotificationsPage.getLayout = (page) => getDashboardLayout(page);

export default AdminNotificationsPage;
