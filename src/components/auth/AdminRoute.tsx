import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserEffectiveModules } from "@/hooks/useModuleAccess";
import { useSuperAdmin, useIsAdmin } from "@/hooks/useSuperAdmin";
import { Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useSuperAdmin();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  // Fast path: super_admin / admin status is cached (60s+) and usually
  // resolves before the page even mounts. Skip the heavier module-access
  // query for these users entirely.
  if (isSuperAdmin || isAdmin) {
    return <>{children}</>;
  }

  // Only non-admins pay for the module access lookup, and only after the
  // role check has resolved (so we don't block twice).
  const roleResolved = !superAdminLoading && !adminLoading;
  const { data: effectiveModules, isLoading: modulesLoading } =
    useUserEffectiveModules(roleResolved ? user?.id : undefined);

  if (!roleResolved || modulesLoading) {
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
