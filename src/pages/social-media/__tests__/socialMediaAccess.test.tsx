import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as any;
Object.assign(window.HTMLElement.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {} });

const m = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  canApprove: true,
  blockReason: null as string | null,
  request: vi.fn(),
  decide: vi.fn(),
  revoke: vi.fn(),
  record: vi.fn(),
}));

// Any query chain resolves to the table's rows.
vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: unknown[]) => {
    const c: any = { then: (res: any) => Promise.resolve({ data: rows, error: null }).then(res) };
    for (const k of ["select", "eq", "in", "order", "limit"]) c[k] = () => c;
    return c;
  };
  return { supabase: { from: (t: string) => chain(m.tables[t] ?? []) } };
});
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co", name: "Lyceum" } }) }));
vi.mock("@/lib/currentUser", () => ({ getCachedUserId: () => "me" }));
vi.mock("@/hooks/useSocialMediaAccess", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useSocialMediaAccess")>()),
  useSocialMediaRights: () => ({ data: { can_approve: m.canApprove } }),
  useSocialMediaCompanyUsers: () => ({ data: [
    { user_id: "me", full_name: "Mia Manager", email: "mia@lgh.lk" },
    { user_id: "u-sam", full_name: "Sam Staff", email: "sam@lgh.lk" },
  ] }),
  useAccessBlockReason: () => ({ data: m.blockReason, isSuccess: true }),
  useRequestSocialMediaAccess: () => ({ mutate: m.request, isPending: false }),
  useDecideSocialMediaAccess: () => ({ mutate: m.decide, isPending: false }),
  useChangeSocialMediaAccessLevel: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeSocialMediaAccess: () => ({ mutate: m.revoke, isPending: false }),
  useRecordSocialMediaNda: () => ({ mutate: m.record, isPending: false }),
}));

import AccessManagement from "@/pages/social-media/AccessManagement";
import NDACompliance from "@/pages/social-media/NDACompliance";

const renderPage = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

const access = (patch = {}) => ({
  id: "a1", account_id: "acc", user_id: "u-sam", access_level: "editor", status: "pending", requested_by: "u-sam",
  decision_note: null, created_at: "2026-09-29T00:00:00Z", social_media_accounts: { account_name: "LGH Official", platform: "instagram" }, ...patch,
});

describe("Access Management", () => {
  beforeEach(() => {
    m.request.mockClear(); m.decide.mockClear(); m.revoke.mockClear();
    m.canApprove = true; m.blockReason = null;
    m.tables = {
      social_media_access: [access()],
      social_media_accounts: [{ id: "acc", account_name: "LGH Official", platform: "instagram" }],
      social_media_ndas: [],
    };
  });

  it("shows the database's reason when a request can't be approved yet", async () => {
    m.blockReason = "A signed, unexpired NDA must be recorded first (NDA Compliance)";
    renderPage(<AccessManagement />);
    const row = (await screen.findByText("Sam Staff")).closest("tr")!;
    expect(within(row).getByText("Waiting for approval")).toBeInTheDocument();
    expect(within(row).getByText("Not recorded")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(within(row).getByText(/NDA must be recorded first/)).toBeInTheDocument();
  });

  it("approves when allowed, and rejecting needs a reason", async () => {
    const user = userEvent.setup();
    renderPage(<AccessManagement />);
    const row = (await screen.findByText("Sam Staff")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Approve" }));
    expect(m.decide).toHaveBeenCalledWith({ accessId: "a1", approve: true });
    await user.click(within(row).getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    const go = within(dialog).getByRole("button", { name: "Reject" });
    expect(go).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/reason/i), "Not needed");
    await user.click(go);
    expect(m.decide).toHaveBeenLastCalledWith({ accessId: "a1", approve: false, note: "Not needed" }, expect.anything());
  });

  it("requests access for a company user by login id", async () => {
    const user = userEvent.setup();
    renderPage(<AccessManagement />);
    await user.click(screen.getByRole("button", { name: /request access/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Account" }));
    await user.click(await screen.findByRole("option", { name: /LGH Official/ }));
    await user.click(within(dialog).getByRole("combobox", { name: "User" }));
    await user.click(await screen.findByRole("option", { name: "Sam Staff" }));
    await user.click(within(dialog).getByRole("button", { name: /request access/i }));
    expect(m.request).toHaveBeenCalledWith({ accountId: "acc", userId: "u-sam", level: "viewer", notes: "" }, expect.anything());
  });

  it("staff without approval rights can only withdraw their own request", async () => {
    m.canApprove = false;
    m.tables.social_media_access = [access({ requested_by: "me" })];
    renderPage(<AccessManagement />);
    const row = (await screen.findByText("Sam Staff")).closest("tr")!;
    expect(within(row).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
  });
});

describe("NDA Compliance", () => {
  beforeEach(() => {
    m.record.mockClear();
    m.tables = { social_media_access: [access()], social_media_ndas: [] };
  });

  it("recording an NDA needs the signed document", async () => {
    const user = userEvent.setup();
    renderPage(<NDACompliance />);
    const row = (await screen.findByText("Sam Staff")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /record nda/i }));
    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: /record nda/i });
    expect(save).toBeDisabled();
    const file = new File(["%PDF"], "nda signed.pdf", { type: "application/pdf" });
    await user.upload(within(dialog).getByLabelText(/signed nda/i), file);
    await user.type(within(dialog).getByLabelText(/witnessed by/i), "Wanda");
    await user.click(save);
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "co", accessId: "a1", file, version: "1.0", witnessName: "Wanda" }),
      expect.anything(),
    );
  });

  it("an expired NDA is offered for renewal and its document can be opened", async () => {
    m.tables.social_media_ndas = [{ id: "n1", access_id: "a1", nda_signed: true, nda_signed_at: "2025-01-01T00:00:00Z",
      nda_expiry_date: "2026-01-01", nda_document_url: "co/a1/old.pdf", created_at: "2025-01-01T00:00:00Z" }];
    renderPage(<NDACompliance />);
    const row = (await screen.findByText("Sam Staff")).closest("tr")!;
    expect(within(row).getByText("Expired")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: /renew/i })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: /view/i })).toBeInTheDocument();
  });
});
