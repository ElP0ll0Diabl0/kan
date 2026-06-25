import { useRouter } from "next/router";
import { useEffect } from "react";

import LoadingSpinner from "~/components/LoadingSpinner";
import { api } from "~/utils/api";

/**
 * Client-side gate for the admin area. Redirects non-superadmins away.
 * The real authorisation boundary is `superAdminProcedure` on the API — this
 * only avoids rendering an empty shell to users who can't use it.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = api.user.getUser.useQuery();

  const isAdmin = user?.isAdmin === true;

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      void router.replace("/boards");
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading || !isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
