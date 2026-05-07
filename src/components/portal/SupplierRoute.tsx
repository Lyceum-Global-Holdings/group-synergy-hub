import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupplierContext } from "@/contexts/SupplierContext";

interface SupplierRouteProps {
  children: React.ReactNode;
  requireRole?: ("owner" | "admin" | "user" | "viewer")[];
}

const RANK: Record<string, number> = { viewer: 0, user: 1, admin: 2, owner: 3 };

export const SupplierRoute: React.FC<SupplierRouteProps> = ({ children, requireRole }) => {
  const { user, loading: authLoading } = useAuth();
  const { loading, memberships, activeMembership } = useSupplierContext();
  const location = useLocation();

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/portal/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (memberships.length === 0) {
    return <Navigate to="/portal/no-access" replace />;
  }

  if (requireRole && activeMembership) {
    const required = Math.max(...requireRole.map((r) => RANK[r] ?? 0));
    if ((RANK[activeMembership.portal_role] ?? 0) < required) {
      return <Navigate to="/portal" replace />;
    }
  }

  return <>{children}</>;
};
