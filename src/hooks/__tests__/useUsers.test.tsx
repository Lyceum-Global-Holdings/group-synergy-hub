import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const db = vi.hoisted(() => ({
  profiles: [
    { user_id: "u1", email: "a@x", full_name: "Ann", deactivated_at: null },
    { user_id: "u2", email: "b@x", full_name: "Ben", deactivated_at: null },
  ],
  signIns: [
    { user_id: "u1", last_sign_in_at: "2026-09-26T08:00:00Z" },
    { user_id: "u2", last_sign_in_at: null },
  ] as Array<{ user_id: string; last_sign_in_at: string | null }> | null,
  signInsError: null as { message: string } | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: async () =>
        table === "profiles_directory" ? { data: db.profiles, error: null } : { data: [], error: null },
    }),
    rpc: async () => ({ data: db.signInsError ? null : db.signIns, error: db.signInsError }),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { useUsers } from "@/hooks/useUsers";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useUsers sign-in status", () => {
  beforeEach(() => {
    db.signInsError = null;
  });

  it("shows real last sign-in times, and null for users who never signed in", async () => {
    const { result } = renderHook(() => useUsers(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const [ann, ben] = result.current.data!;
    expect(ann).toMatchObject({ last_sign_in_at: "2026-09-26T08:00:00Z", sign_in_known: true });
    expect(ben).toMatchObject({ last_sign_in_at: null, sign_in_known: true });
  });

  it("marks sign-ins unknown instead of claiming 'never' when they can't be loaded", async () => {
    db.signInsError = { message: "function admin_user_sign_ins() does not exist" };
    const { result } = renderHook(() => useUsers(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.every((u) => u.sign_in_known === false && u.last_sign_in_at === null)).toBe(true);
  });
});
