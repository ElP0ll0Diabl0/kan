import type { NextPageWithLayout } from "~/pages/_app";
import { AdminLayout } from "~/components/AdminLayout";
import { getDashboardLayout } from "~/components/Dashboard";
import { AdminGuard } from "~/views/admin/components/AdminGuard";
import { Members } from "~/views/admin/Members";

const AdminMembersPage: NextPageWithLayout = () => {
  return (
    <AdminGuard>
      <AdminLayout currentTab="members">
        <Members />
      </AdminLayout>
    </AdminGuard>
  );
};

AdminMembersPage.getLayout = (page) => getDashboardLayout(page);

export default AdminMembersPage;
