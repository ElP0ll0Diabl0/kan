import type { NextPageWithLayout } from "~/pages/_app";
import { AdminLayout } from "~/components/AdminLayout";
import { getDashboardLayout } from "~/components/Dashboard";
import { AdminGuard } from "~/views/admin/components/AdminGuard";
import { Overview } from "~/views/admin/Overview";

const AdminOverviewPage: NextPageWithLayout = () => {
  return (
    <AdminGuard>
      <AdminLayout currentTab="overview">
        <Overview />
      </AdminLayout>
    </AdminGuard>
  );
};

AdminOverviewPage.getLayout = (page) => getDashboardLayout(page);

export default AdminOverviewPage;
