import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserEffectiveModules } from "@/hooks/useModuleAccess";
import { Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { data: effectiveModules, isLoading } = useUserEffectiveModules(user?.id);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!effectiveModules?.availableModules.includes('administration')) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};
