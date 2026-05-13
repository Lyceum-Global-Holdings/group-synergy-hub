import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserEffectiveModules } from "@/hooks/useModuleAccess";
import { useSuperAdmin, useIsAdmin } from "@/hooks/useSuperAdmin";
import { Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { data: effectiveModules, isLoading } = useUserEffectiveModules(user?.id);
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useSuperAdmin();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  if (isLoading || superAdminLoading || adminLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const hasAdminRole = !!isSuperAdmin || !!isAdmin;
  const hasAdministrationModule = effectiveModules?.availableModules.includes('administration');

  if (!hasAdminRole && !hasAdministrationModule) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
