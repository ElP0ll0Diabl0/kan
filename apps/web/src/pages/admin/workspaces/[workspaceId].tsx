import type { NextPageWithLayout } from "~/pages/_app";
import { AdminLayout } from "~/components/AdminLayout";
import { getDashboardLayout } from "~/components/Dashboard";
import { AdminGuard } from "~/views/admin/components/AdminGuard";
import { WorkspaceDetail } from "~/views/admin/WorkspaceDetail";

const AdminWorkspaceDetailPage: NextPageWithLayout = () => {
  return (
    <AdminGuard>
      <AdminLayout currentTab="workspaces">
        <WorkspaceDetail />
      </AdminLayout>
    </AdminGuard>
  );
};

AdminWorkspaceDetailPage.getLayout = (page) => getDashboardLayout(page);

export default AdminWorkspaceDetailPage;
