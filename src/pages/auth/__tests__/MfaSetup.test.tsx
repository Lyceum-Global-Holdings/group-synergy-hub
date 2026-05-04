import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/test/qrcodeMock";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mfaState, resetMfaMockState, supabaseMock } from "@/test/mfaMocks";

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import MfaSetup from "@/pages/auth/MfaSetup";
import { renderWithRouter } from "@/test/renderWithRouter";

describe("MfaSetup", () => {
  beforeEach(() => {
    resetMfaMockState();
    navigateMock.mockReset();
    vi.clearAllMocks();
  });

  it("enrollment happy path: enroll → verify → recovery codes shown", async () => {
    const user = userEvent.setup();
    renderWithRouter(<MfaSetup />);

    const enableBtn = await screen.findByRole("button", { name: /enable two-factor/i });
    await user.click(enableBtn);

    // QR + secret rendered
    await screen.findByAltText(/scan with authenticator/i);
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/verification code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify and activate/i }));

    // Recovery codes step
    await screen.findByText(/save these codes in a safe place/i);
    const codeNodes = screen.getAllByText(/^CODE\d{2}-XXXXX$/);
    expect(codeNodes).toHaveLength(10);
    expect(mfaState.recoveryCodes.size).toBe(10);
    // Factor is verified, AAL elevated
    expect(mfaState.aal.currentLevel).toBe("aal2");
    expect(mfaState.factors[0].status).toBe("verified");
  });

  it("sweeps stale unverified factors before enrolling (no name conflict)", async () => {
    // Pre-seed an unverified factor that would otherwise collide
    mfaState.factors.push({ id: "stale-1", status: "unverified", friendly_name: "Authenticator stale" });
    const user = userEvent.setup();
    renderWithRouter(<MfaSetup />);

    await user.click(await screen.findByRole("button", { name: /enable two-factor/i }));
    await screen.findByAltText(/scan with authenticator/i);

    expect(supabaseMock.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: "stale-1" });
    // New factor exists and is unverified, stale removed
    expect(mfaState.factors.find((f) => f.id === "stale-1")).toBeUndefined();
    expect(mfaState.factors.length).toBe(1);
  });

  it("invalid verification code keeps user on verify step and surfaces an error", async () => {
    const user = userEvent.setup();
    renderWithRouter(<MfaSetup />);
    await user.click(await screen.findByRole("button", { name: /enable two-factor/i }));
    await screen.findByAltText(/scan with authenticator/i);

    await user.type(screen.getByLabelText(/verification code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify and activate/i }));

    await waitFor(() => expect(screen.getByText(/verification failed/i)).toBeInTheDocument());
    // Still on verify step, factor still unverified
    expect(screen.getByAltText(/scan with authenticator/i)).toBeInTheDocument();
    expect(mfaState.factors[0].status).toBe("unverified");
    expect(mfaState.aal.currentLevel).toBe("aal1");
  });

  it("recovery codes can be copied and downloaded", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const user = userEvent.setup();
    renderWithRouter(<MfaSetup />);
    await user.click(await screen.findByRole("button", { name: /enable two-factor/i }));
    await screen.findByAltText(/scan with authenticator/i);
    await user.type(screen.getByLabelText(/verification code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify and activate/i }));

    await screen.findByText(/save these codes in a safe place/i);

    await user.click(screen.getByRole("button", { name: /^copy$/i }));
    expect(writeText).toHaveBeenCalled();
    const written = (writeText.mock.calls[0] as any[])[0] as string;
    expect(written.split("\n")).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: /^download$/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("regenerate recovery codes invalidates the previous set when MFA already active", async () => {
    // User already at AAL2 with verified factor
    mfaState.factors.push({ id: "f1", status: "verified", friendly_name: "Authenticator existing" });
    mfaState.aal = { currentLevel: "aal2", nextLevel: "aal2" };
    mfaState.recoveryCodes = new Set(["OLD01-XXXXX"]);

    const user = userEvent.setup();
    renderWithRouter(<MfaSetup />);

    const regen = await screen.findByRole("button", { name: /regenerate recovery codes/i });
    await user.click(regen);

    await screen.findByText(/save these codes in a safe place/i);
    expect(mfaState.recoveryCodes.has("OLD01-XXXXX")).toBe(false);
    expect(mfaState.recoveryCodes.size).toBe(10);
  });
});
