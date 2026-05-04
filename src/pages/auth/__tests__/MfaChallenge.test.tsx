import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mfaState, resetMfaMockState, supabaseMock } from "@/test/mfaMocks";

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import MfaChallenge from "@/pages/auth/MfaChallenge";
import { renderWithRouter } from "@/test/renderWithRouter";

function seedEnrolledAal1() {
  mfaState.factors.push({ id: "f1", status: "verified", friendly_name: "Authenticator existing" });
  mfaState.aal = { currentLevel: "aal1", nextLevel: "aal2" };
  mfaState.recoveryCodes = new Set(["GOOD1-XXXXX", "GOOD2-XXXXX"]);
}

describe("MfaChallenge", () => {
  beforeEach(() => {
    resetMfaMockState();
    navigateMock.mockReset();
    vi.clearAllMocks();
  });

  it("TOTP success → navigates to /", async () => {
    seedEnrolledAal1();
    const user = userEvent.setup();
    renderWithRouter(<MfaChallenge />, { route: "/auth/mfa" });

    const input = await screen.findByLabelText(/verification code/i);
    await user.type(input, "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/", { replace: true }));
    expect(mfaState.aal.currentLevel).toBe("aal2");
  });

  it("TOTP failure shows error toast and stays on challenge", async () => {
    seedEnrolledAal1();
    const user = userEvent.setup();
    renderWithRouter(<MfaChallenge />, { route: "/auth/mfa" });

    await user.type(await screen.findByLabelText(/verification code/i), "000000");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => expect(screen.getByText(/verification failed/i)).toBeInTheDocument());
    expect(mfaState.aal.currentLevel).toBe("aal1");
    expect(navigateMock).not.toHaveBeenCalledWith("/", expect.anything());
  });

  it("recovery code success → routes to /account/mfa for re-enrollment", async () => {
    seedEnrolledAal1();
    const user = userEvent.setup();
    renderWithRouter(<MfaChallenge />, { route: "/auth/mfa" });

    await user.click(await screen.findByRole("button", { name: /use a recovery code/i }));
    await user.type(screen.getByLabelText(/recovery code/i), "good1-xxxxx");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/account/mfa", { replace: true }),
    );
    expect(mfaState.recoveryCodes.has("GOOD1-XXXXX")).toBe(false);
  });

  it("recovery code reuse fails on second attempt", async () => {
    seedEnrolledAal1();
    const user = userEvent.setup();

    // First call: consume programmatically
    await supabaseMock.rpc("consume_mfa_recovery_code", { p_code: "GOOD1-XXXXX" });

    renderWithRouter(<MfaChallenge />, { route: "/auth/mfa" });
    await user.click(await screen.findByRole("button", { name: /use a recovery code/i }));
    await user.type(screen.getByLabelText(/recovery code/i), "GOOD1-XXXXX");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() =>
      expect(screen.getByText(/invalid or already-used recovery code/i)).toBeInTheDocument(),
    );
    expect(navigateMock).not.toHaveBeenCalledWith("/account/mfa", expect.anything());
  });

  it("auto-redirects when AAL already aal2", async () => {
    mfaState.factors.push({ id: "f1", status: "verified", friendly_name: "x" });
    mfaState.aal = { currentLevel: "aal2", nextLevel: "aal2" };
    renderWithRouter(<MfaChallenge />, { route: "/auth/mfa" });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/", { replace: true }));
  });

  it("auto-redirects when no verified factor exists", async () => {
    mfaState.aal = { currentLevel: "aal1", nextLevel: "aal1" };
    renderWithRouter(<MfaChallenge />, { route: "/auth/mfa" });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/", { replace: true }));
  });

  it("sign out from challenge calls signOut and routes to /auth", async () => {
    seedEnrolledAal1();
    const user = userEvent.setup();
    renderWithRouter(<MfaChallenge />, { route: "/auth/mfa" });

    await user.click(await screen.findByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(supabaseMock.auth.signOut).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith("/auth", { replace: true });
  });
});
