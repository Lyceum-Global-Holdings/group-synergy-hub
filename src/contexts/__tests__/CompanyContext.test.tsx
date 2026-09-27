import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  userId: "user-1",
  isSuperAdmin: false,
  companies: [
    { id: "co-a", name: "Alpha", modules: {} },
    { id: "co-b", name: "Beta", modules: {} },
  ],
}));

vi.mock("@/hooks/useCompanies", () => ({
  useCompanies: () => ({ companies: state.companies, isLoading: false }),
}));
vi.mock("@/hooks/useSuperAdmin", () => ({
  useSuperAdmin: () => ({ data: state.isSuperAdmin, isLoading: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: state.userId } }),
}));
vi.mock("@/integrations/supabase/client", () => {
  const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: null, error: null }) };
  return { supabase: { from: () => chain } };
});

import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <CompanyProvider>{children}</CompanyProvider>
    </QueryClientProvider>
  );
}

const render = () => renderHook(() => useCompany(), { wrapper });

describe("CompanyContext remembers the chosen company", () => {
  beforeEach(() => {
    window.localStorage.clear();
    state.userId = "user-1";
    state.isSuperAdmin = false;
  });

  it("asks a user with several companies to choose when nothing is remembered", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedCompany).toBeNull();
    expect(result.current.isViewingAllCompanies).toBe(false);
  });

  it("remembers a choice across a reload", async () => {
    const first = render();
    act(() => first.result.current.setSelectedCompany(state.companies[1] as never));
    expect(window.localStorage.getItem("selectedCompany:user-1")).toBe("co-b");
    expect(window.localStorage.getItem("selectedCompanyId")).toBe("co-b");
    first.unmount();

    const { result } = render();
    await waitFor(() => expect(result.current.selectedCompany?.id).toBe("co-b"));
  });

  it("forgets a company the user can no longer access", async () => {
    window.localStorage.setItem("selectedCompany:user-1", "co-gone");
    const { result } = render();
    await waitFor(() => expect(window.localStorage.getItem("selectedCompany:user-1")).toBeNull());
    expect(result.current.selectedCompany).toBeNull();
  });

  it("keeps each user's choice separate on a shared computer", async () => {
    window.localStorage.setItem("selectedCompany:user-1", "co-b");
    state.userId = "user-2";
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedCompany).toBeNull();
  });

  it("restores the super-admin All Companies view", async () => {
    state.isSuperAdmin = true;
    window.localStorage.setItem("selectedCompany:user-1", "co-a");
    const first = render();
    await waitFor(() => expect(first.result.current.selectedCompany?.id).toBe("co-a"));
    act(() => first.result.current.setSelectedCompany(null));
    expect(window.localStorage.getItem("selectedCompany:user-1")).toBe("all");
    first.unmount();

    const { result } = render();
    await waitFor(() => expect(result.current.isViewingAllCompanies).toBe(true));
  });

  it("does not give a non-super-admin the All Companies view", async () => {
    window.localStorage.setItem("selectedCompany:user-1", "all");
    const { result } = render();
    await waitFor(() => expect(window.localStorage.getItem("selectedCompany:user-1")).toBeNull());
    expect(result.current.isViewingAllCompanies).toBe(false);
  });
});
