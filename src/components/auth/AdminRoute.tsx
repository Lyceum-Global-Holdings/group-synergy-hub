import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserEffectiveModules } from "@/hooks/useModuleAccess";
import { useSuperAdmin, useIsAdmin } from "@/hooks/useSuperAdmin";
import { Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useSuperAdmin();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  // Defer the heavier module-access query: only fetch once role checks have
  // settled AND the user is NOT already admin/super_admin. Admin/super_admin
  // status is cached aggressively so this usually resolves instantly without
  // ever firing the module query.
  const roleResolved = !superAdminLoading && !adminLoading;
  const hasAdminRole = !!isSuperAdmin || !!isAdmin;
  const needsModuleCheck = roleResolved && !hasAdminRole;

  const { data: effectiveModules, isLoading: modulesLoading } =
    useUserEffectiveModules(needsModuleCheck ? user?.id : undefined);

  if (hasAdminRole) return <>{children}</>;

  if (!roleResolved || (needsModuleCheck && modulesLoading)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!effectiveModules?.availableModules.includes("administration")) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
