import type { NextPageWithLayout } from "~/pages/_app";
import { AdminLayout } from "~/components/AdminLayout";
import { getDashboardLayout } from "~/components/Dashboard";
import { Integrations } from "~/views/admin/Integrations";
import { AdminGuard } from "~/views/admin/components/AdminGuard";

const AdminIntegrationsPage: NextPageWithLayout = () => {
  return (
    <AdminGuard>
      <AdminLayout currentTab="integrations">
        <Integrations />
      </AdminLayout>
    </AdminGuard>
  );
};

AdminIntegrationsPage.getLayout = (page) => getDashboardLayout(page);

export default AdminIntegrationsPage;
