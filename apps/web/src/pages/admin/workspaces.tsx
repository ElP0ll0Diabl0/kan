import type { NextPageWithLayout } from "~/pages/_app";
import { AdminLayout } from "~/components/AdminLayout";
import { getDashboardLayout } from "~/components/Dashboard";
import { AdminGuard } from "~/views/admin/components/AdminGuard";
import { Workspaces } from "~/views/admin/Workspaces";

const AdminWorkspacesPage: NextPageWithLayout = () => {
  return (
    <AdminGuard>
      <AdminLayout currentTab="workspaces">
        <Workspaces />
      </AdminLayout>
    </AdminGuard>
  );
};

AdminWorkspacesPage.getLayout = (page) => getDashboardLayout(page);

export default AdminWorkspacesPage;
