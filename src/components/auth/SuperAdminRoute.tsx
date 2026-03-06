import { Navigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Loader2 } from "lucide-react";

export const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { data: isSuperAdmin, isLoading } = useSuperAdmin();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
