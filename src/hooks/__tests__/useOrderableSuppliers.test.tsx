import { describe, it, expect, vi } from "vitest";
import { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: () => ({ selectedCompany: { id: "co-a" }, isViewingAllCompanies: false }),
}));
vi.mock("@/hooks/useSuperAdmin", () => ({ useSuperAdmin: () => ({ data: false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => {
  const allocations = [
    { supplier: { id: "good", name: "Good Co" } },
    { supplier: { id: "bad", name: "Bad Co" } },
    { supplier: { id: "watch", name: "Watch Co" } },
  ];
  const blacklist = [
    { supplier_id: "bad", status: "blacklisted" },
    { supplier_id: "watch", status: "watchlist" },
  ];
  const from = (table: string) => {
    const result = table === "supplier_blacklist" ? blacklist : allocations;
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: async () => ({ data: result, error: null }),
      order: async () => ({ data: result, error: null }),
    };
    return chain;
  };
  return { supabase: { from } };
});

import { useOrderableSuppliers } from "@/hooks/useSuppliers";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useOrderableSuppliers", () => {
  it("leaves out blacklisted suppliers and flags watch-listed ones", async () => {
    const { result } = renderHook(() => useOrderableSuppliers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data.map((s) => [s.id, s.watchlisted])).toEqual([
      ["good", false],
      ["watch", true],
    ]);
  });
});
