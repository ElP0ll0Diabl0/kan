import type { NextPageWithLayout } from "~/pages/_app";
import { AdminLayout } from "~/components/AdminLayout";
import { getDashboardLayout } from "~/components/Dashboard";
import { AdminGuard } from "~/views/admin/components/AdminGuard";
import { MemberDetail } from "~/views/admin/MemberDetail";

const AdminMemberDetailPage: NextPageWithLayout = () => {
  return (
    <AdminGuard>
      <AdminLayout currentTab="members">
        <MemberDetail />
      </AdminLayout>
    </AdminGuard>
  );
};

AdminMemberDetailPage.getLayout = (page) => getDashboardLayout(page);

export default AdminMemberDetailPage;
