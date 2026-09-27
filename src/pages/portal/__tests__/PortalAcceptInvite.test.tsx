import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  user: null as { email: string } | null,
  turnstileEnabled: false,
  invoke: vi.fn(),
  signIn: vi.fn(),
  refresh: vi.fn(async () => {}),
  navigate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: m.invoke }, auth: { signInWithPassword: m.signIn } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: m.user, loading: false }) }));
vi.mock("@/contexts/SupplierContext", () => ({ useSupplierContext: () => ({ refresh: m.refresh }) }));
vi.mock("@/hooks/useTurnstileSiteKey", () => ({ useTurnstileSiteKey: () => ({ data: { siteKey: "site-key" } }) }));
vi.mock("@/hooks/usePublicSecuritySettings", () => ({ useTurnstileEnabledFor: () => m.turnstileEnabled }));
vi.mock("@/components/security/TurnstileWidget", () => ({ default: () => <div data-testid="captcha" /> }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return { ...actual, useNavigate: () => m.navigate };
});

import PortalAcceptInvite from "@/pages/portal/PortalAcceptInvite";
import { renderWithRouter } from "@/test/renderWithRouter";

const LINK = "/portal/accept-invite?token=" + "t".repeat(40) + "&id=11111111-1111-1111-1111-111111111111";

describe("PortalAcceptInvite", () => {
  beforeEach(() => {
    m.user = null;
    m.turnstileEnabled = false;
    m.invoke.mockReset();
    m.signIn.mockReset().mockResolvedValue({ error: null });
    m.navigate.mockReset();
  });

  it("lets a new supplier contact set a password and join", async () => {
    m.invoke.mockResolvedValue({ data: { success: true, email: "sam@supplier.lk" }, error: null });
    const user = userEvent.setup();
    renderWithRouter(<PortalAcceptInvite />, { route: LINK });

    expect(screen.queryByPlaceholderText("Token")).not.toBeInTheDocument(); // filled from the link
    await user.type(screen.getByLabelText(/your name/i), "Sam");
    await user.type(screen.getByLabelText(/^password$/i), "supplier-pass");
    await user.type(screen.getByLabelText(/confirm password/i), "supplier-pass");
    await user.click(screen.getByRole("button", { name: /create account and join/i }));

    await waitFor(() => expect(m.navigate).toHaveBeenCalled(), { timeout: 2000 });
    expect(m.invoke).toHaveBeenCalledWith("supplier-accept-invite", {
      body: expect.objectContaining({ password: "supplier-pass", full_name: "Sam", invitation_id: "11111111-1111-1111-1111-111111111111" }),
    });
    expect(m.signIn).toHaveBeenCalledWith({ email: "sam@supplier.lk", password: "supplier-pass" });
    expect(m.refresh).toHaveBeenCalled();
  });

  it("refuses mismatched passwords without calling the server", async () => {
    const user = userEvent.setup();
    renderWithRouter(<PortalAcceptInvite />, { route: LINK });
    await user.type(screen.getByLabelText(/^password$/i), "supplier-pass");
    await user.type(screen.getByLabelText(/confirm password/i), "different-pass");
    await user.click(screen.getByRole("button", { name: /create account and join/i }));
    expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument();
    expect(m.invoke).not.toHaveBeenCalled();
  });

  it("shows the server's reason, e.g. an existing account", async () => {
    m.invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: "An account already exists for sam@supplier.lk. Sign in with it, then accept the invitation." })) },
    });
    const user = userEvent.setup();
    renderWithRouter(<PortalAcceptInvite />, { route: LINK });
    await user.type(screen.getByLabelText(/^password$/i), "supplier-pass");
    await user.type(screen.getByLabelText(/confirm password/i), "supplier-pass");
    await user.click(screen.getByRole("button", { name: /create account and join/i }));
    expect(await screen.findByText(/account already exists/i)).toBeInTheDocument();
    expect(m.signIn).not.toHaveBeenCalled();
  });

  it("signed-in users accept without a bot check when bot protection is off", async () => {
    m.user = { email: "sam@supplier.lk" };
    m.invoke.mockResolvedValue({ data: { success: true }, error: null });
    const user = userEvent.setup();
    renderWithRouter(<PortalAcceptInvite />, { route: LINK });

    expect(screen.queryByTestId("captcha")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /accept invitation/i }));
    await waitFor(() => expect(m.invoke).toHaveBeenCalled());
    expect(m.invoke.mock.calls[0][1].body).not.toHaveProperty("password");
  });

  it("waits for the bot check when bot protection is on", () => {
    m.user = { email: "sam@supplier.lk" };
    m.turnstileEnabled = true;
    renderWithRouter(<PortalAcceptInvite />, { route: LINK });
    expect(screen.getByTestId("captcha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept invitation/i })).toBeDisabled();
  });
});
