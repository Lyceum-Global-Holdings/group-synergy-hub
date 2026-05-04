import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { mfaState, resetMfaMockState, supabaseMock } from "@/test/mfaMocks";

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

// Stub useAuth so ProtectedRoute can be tested in isolation
const authValue: { user: any; loading: boolean } = { user: null, loading: false };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authValue,
}));

import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render } from "@testing-library/react";
import ProtectedRoute from "@/components/common/ProtectedRoute";

function renderApp(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/auth" element={<div>AUTH PAGE</div>} />
        <Route path="/auth/mfa" element={<div>MFA CHALLENGE</div>} />
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <div>SECRET CONTENT</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    resetMfaMockState();
    authValue.user = null;
    authValue.loading = false;
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to /auth", async () => {
    renderApp("/secret");
    expect(await screen.findByText("AUTH PAGE")).toBeInTheDocument();
  });

  it("renders children when authenticated and no MFA enrolled", async () => {
    authValue.user = { id: "u1", email: "x@y.z" };
    mfaState.aal = { currentLevel: "aal1", nextLevel: "aal1" };
    renderApp("/secret");
    expect(await screen.findByText("SECRET CONTENT")).toBeInTheDocument();
  });

  it("redirects to /auth/mfa when MFA enrolled but session is AAL1", async () => {
    authValue.user = { id: "u1", email: "x@y.z" };
    mfaState.factors.push({ id: "f1", status: "verified", friendly_name: "x" });
    mfaState.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    renderApp("/secret");
    await waitFor(() => expect(screen.getByText("MFA CHALLENGE")).toBeInTheDocument());
  });

  it("renders children when AAL2 even with verified factor", async () => {
    authValue.user = { id: "u1", email: "x@y.z" };
    mfaState.factors.push({ id: "f1", status: "verified", friendly_name: "x" });
    mfaState.aal = { currentLevel: "aal2", nextLevel: "aal2" };
    renderApp("/secret");
    expect(await screen.findByText("SECRET CONTENT")).toBeInTheDocument();
  });
});
