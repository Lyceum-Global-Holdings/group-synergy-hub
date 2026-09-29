import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as any;
Object.assign(window.HTMLElement.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {} });

const m = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  record: vi.fn(),
  post: vi.fn(),
  decide: vi.fn(),
  queue: [] as any[],
  sent: [] as any[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: unknown[]) => {
    const c: any = { then: (res: any) => Promise.resolve({ data: rows, error: null }).then(res) };
    for (const k of ["select", "eq", "in", "order", "limit"]) c[k] = () => c;
    return c;
  };
  return { supabase: { from: (t: string) => chain(m.tables[t] ?? []) } };
});
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co" } }) }));
vi.mock("@/hooks/useSuppliers", () => ({ useSuppliers: () => ({ data: [{ id: "s1", name: "Lanka Cement", supplier_code: "SUP00001" }] }) }));
vi.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));
vi.mock("@/hooks/finance/useBankAccounts", () => ({ useBankAccounts: () => ({ bankAccounts: [{ id: "b1", account_name: "Current", bank_name: "HNB", is_default: true }] }) }));
vi.mock("@/hooks/useGLSettings", () => ({ useGLSettings: () => ({ currencySymbol: "Rs." }) }));
vi.mock("@/hooks/finance/useFinancePosting", async (orig) => ({
  ...(await orig<typeof import("@/hooks/finance/useFinancePosting")>()),
  useRecordMoney: () => ({ mutate: m.record, isPending: false }),
  usePostInvoice: () => ({ mutate: m.post, isPending: false }),
}));
vi.mock("@/hooks/useApprovalConsole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useApprovalConsole")>()),
  useApprovalQueue: (scope: string) => ({ data: scope === "to_decide" ? m.queue : m.sent, isLoading: false, error: null, refetch: vi.fn() }),
  useDecideApprovalItem: () => ({ mutate: m.decide, isPending: false }),
}));
vi.mock("@/components/management/reports/GenerateReportButton", () => ({ GenerateReportButton: () => null }));

import { RecordMoneyDialog } from "@/components/finance/RecordMoneyDialog";
import { SupplierInvoiceList } from "@/components/finance/ap/SupplierInvoiceList";
import ApprovalConsole from "@/pages/management/ApprovalConsole";

const renderIt = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe("Record supplier payment", () => {
  beforeEach(() => {
    m.record.mockClear();
    m.tables = { supplier_invoices: [
      { id: "i1", invoice_number: "SI-1", invoice_date: "2026-09-01", gross_amount: 100000, amount_paid: 40000 },
      { id: "i2", invoice_number: "SI-2", invoice_date: "2026-09-10", gross_amount: 50000, amount_paid: 0 },
    ] };
  });

  it("fills the oldest invoices first and records it in one step", async () => {
    const user = userEvent.setup();
    renderIt(<RecordMoneyDialog kind="payment" open onOpenChange={() => {}} />);
    await user.click(screen.getByRole("combobox", { name: "Supplier" }));
    await user.click(await screen.findByRole("option", { name: /Lanka Cement/ }));
    await user.type(screen.getByLabelText(/amount \*/i), "80000");
    await user.click(await screen.findByRole("button", { name: /fill oldest first/i }));
    expect(screen.getByLabelText("Allocate to SI-1")).toHaveValue("60000");
    expect(screen.getByLabelText("Allocate to SI-2")).toHaveValue("20000");
    await user.click(screen.getByRole("button", { name: /record payment/i }));
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "co", partyId: "s1", bankAccountId: "b1", amount: 80000, method: "wire",
        allocations: [{ invoice_id: "i1", amount: 60000 }, { invoice_id: "i2", amount: 20000 }] }),
      expect.anything(),
    );
  });

  it("won't allocate more than an invoice owes", async () => {
    const user = userEvent.setup();
    renderIt(<RecordMoneyDialog kind="payment" open onOpenChange={() => {}} />);
    await user.click(screen.getByRole("combobox", { name: "Supplier" }));
    await user.click(await screen.findByRole("option", { name: /Lanka Cement/ }));
    await user.type(screen.getByLabelText(/amount \*/i), "100000");
    await user.type(await screen.findByLabelText("Allocate to SI-1"), "70000");
    expect(screen.getByText(/more than that invoice's outstanding/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record payment/i })).toBeDisabled();
  });
});

describe("Supplier invoice list", () => {
  it("offers Post only for invoices that can still be posted", async () => {
    m.post.mockClear();
    m.tables = { supplier_invoices: [
      { id: "i1", invoice_number: "SI-1", invoice_date: "2026-09-01", due_date: "2026-10-01", gross_amount: 100, status: "draft", supplier: { name: "A" } },
      { id: "i2", invoice_number: "SI-2", invoice_date: "2026-09-01", due_date: "2026-10-01", gross_amount: 100, status: "posted", supplier: { name: "B" } },
    ] };
    renderIt(<SupplierInvoiceList />);
    const draft = (await screen.findByText("SI-1")).closest("tr")!;
    const posted = screen.getByText("SI-2").closest("tr")!;
    expect(within(posted).queryByRole("button", { name: "Post" })).not.toBeInTheDocument();
    await userEvent.click(within(draft).getByRole("button", { name: "Post" }));
    expect(m.post).toHaveBeenCalledWith("i1");
  });
});

describe("Approval console", () => {
  beforeEach(() => {
    m.decide.mockClear();
    m.queue = [{ item_type: "po", item_id: "p1", reference: "PO-1", title: "Lanka Cement", amount: 5000, currency: "LKR",
      company_id: "co", submitted_at: "2026-09-29T01:00:00Z", submitted_by: "u", stage: "Merchandiser approval", view_url: "/procurement/purchase-order" }];
    m.sent = [{ ...m.queue[0], item_type: "pr", item_id: "r1", reference: "PR-9", title: "Sand", stage: "Final approval" }];
  });

  it("approves what is waiting, and rejecting needs a reason", async () => {
    const user = userEvent.setup();
    renderIt(<ApprovalConsole />);
    expect(screen.getByRole("tab", { name: /waiting for me \(1\)/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^approve$/i }));
    expect(m.decide).toHaveBeenCalledWith({ type: "po", id: "p1", approve: true, comments: "" }, expect.anything());
    await user.keyboard("{Escape}"); // the mocked decision never finishes, so close the dialog

    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    const reject = within(dialog).getByRole("button", { name: /^reject$/i });
    expect(reject).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/reason/i), "Too expensive");
    await user.click(reject);
    expect(m.decide).toHaveBeenLastCalledWith({ type: "po", id: "p1", approve: false, comments: "Too expensive" }, expect.anything());
  });

  it("items I sent are listed without decision buttons", async () => {
    const user = userEvent.setup();
    renderIt(<ApprovalConsole />);
    await user.click(screen.getByRole("tab", { name: /sent by me/i }));
    expect(await screen.findByText("PR-9")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^approve$/i })).toHaveLength(0);
  });
});
