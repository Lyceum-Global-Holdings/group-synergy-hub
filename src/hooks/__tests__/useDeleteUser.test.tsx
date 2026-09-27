import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { invoke, toast } = vi.hoisted(() => ({
  invoke: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("sonner", () => ({ toast }));

import { useDeleteUser } from "@/hooks/useUserMutations";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDeleteUser", () => {
  beforeEach(() => {
    invoke.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
  });

  it("calls the admin-delete-user function, not the browser admin API", async () => {
    invoke.mockResolvedValue({ data: { success: true, outcome: "deleted" }, error: null });
    const { result } = renderHook(() => useDeleteUser(), { wrapper });

    await expect(result.current.mutateAsync("user-2")).resolves.toEqual({ userId: "user-2", outcome: "deleted" });
    expect(invoke).toHaveBeenCalledWith("admin-delete-user", { body: { userId: "user-2" } });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("User deleted"));
  });

  it("explains when a user with records is deactivated instead", async () => {
    invoke.mockResolvedValue({ data: { success: true, outcome: "deactivated" }, error: null });
    const { result } = renderHook(() => useDeleteUser(), { wrapper });

    await result.current.mutateAsync("user-3");
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "User deactivated",
        expect.objectContaining({ description: expect.stringMatching(/login no longer works/i) }),
      ),
    );
  });

  it("shows the server's reason when it refuses", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ success: false, error: "You can't delete your own account." })) },
    });
    const { result } = renderHook(() => useDeleteUser(), { wrapper });

    await expect(result.current.mutateAsync("me")).rejects.toThrow("You can't delete your own account.");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/your own account/)));
  });
});
