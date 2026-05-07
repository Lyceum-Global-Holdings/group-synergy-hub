import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PortalRole = "owner" | "admin" | "user" | "viewer";

export interface SupplierMembership {
  id: string;
  supplier_id: string;
  user_id: string;
  portal_role: PortalRole;
  is_active: boolean;
  supplier_name?: string;
}

interface SupplierContextValue {
  loading: boolean;
  memberships: SupplierMembership[];
  activeSupplierId: string | null;
  activeMembership: SupplierMembership | null;
  setActiveSupplierId: (id: string) => void;
  refresh: () => Promise<void>;
}

const SupplierContext = createContext<SupplierContextValue | undefined>(undefined);

const STORAGE_KEY = "portal.activeSupplierId";

export const SupplierProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<SupplierMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSupplierId, setActiveSupplierIdState] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null),
  );

  const setActiveSupplierId = (id: string) => {
    setActiveSupplierIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  };

  const load = async () => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("supplier_users")
      .select("id, supplier_id, user_id, portal_role, is_active, suppliers(name)")
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (error) {
      console.error("SupplierContext load error", error);
      setMemberships([]);
    } else {
      const rows = (data ?? []).map((r: any) => ({
        id: r.id,
        supplier_id: r.supplier_id,
        user_id: r.user_id,
        portal_role: r.portal_role as PortalRole,
        is_active: r.is_active,
        supplier_name: r.suppliers?.name ?? undefined,
      }));
      setMemberships(rows);
      if (!activeSupplierId && rows.length > 0) setActiveSupplierId(rows[0].supplier_id);
      if (activeSupplierId && !rows.find((r) => r.supplier_id === activeSupplierId)) {
        setActiveSupplierId(rows[0]?.supplier_id ?? "");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const activeMembership = useMemo(
    () => memberships.find((m) => m.supplier_id === activeSupplierId) ?? null,
    [memberships, activeSupplierId],
  );

  return (
    <SupplierContext.Provider
      value={{ loading, memberships, activeSupplierId, activeMembership, setActiveSupplierId, refresh: load }}
    >
      {children}
    </SupplierContext.Provider>
  );
};

export const useSupplierContext = () => {
  const ctx = useContext(SupplierContext);
  if (!ctx) throw new Error("useSupplierContext must be used within SupplierProvider");
  return ctx;
};
