import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as any;
Object.assign(window.HTMLElement.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {} });

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  tables: {} as Record<string, unknown[]>,
  stock: null as unknown,
  deposits: {} as Record<string, unknown>,
}));

vi.mock("@/lib/untypedRpc", () => ({
  untypedRpc: (fn: string, args: Record<string, unknown>) => {
    m.rpc(fn, args);
    if (fn === "stock_ledger_status") return Promise.resolve(m.stock);
    if (fn === "post_stock_to_ledger") return Promise.resolve({ journals: 2, rows: 5, problems: [] });
    return Promise.resolve("ok");
  },
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/finance/useBankAccounts", () => ({ useBankAccounts: () => ({ bankAccounts: [{ id: "b1", account_name: "Current", bank_name: "HNB", is_default: true }] }) }));

import { AccountingPeriodsTab } from "@/components/finance/AccountingPeriodsTab";
import { RentalBillingCard } from "@/components/tuh-modules/costume-rental/RentalBillingCard";
import type { RentalOrder } from "@/types/costumeRental";

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
const calls = (fn: string) => m.rpc.mock.calls.filter((c) => c[0] === fn).map((c) => c[1]);

const period = (n: number, month: string, status: string) => ({
  id: `p${n}`, period_name: `${month} 2026`, fiscal_year: 2027, period_number: n, status,
  start_date: `2026-${String(n + 3).padStart(2, "0")}-01`, end_date: `2026-${String(n + 3).padStart(2, "0")}-28`, closed_date: status === "closed" ? "2026-06-02" : null,
});

beforeEach(() => {
  m.rpc.mockClear();
  m.stock = { configured: true, start_date: "2026-09-01", pending: 3, pending_value: 4500, problems: [{ document: "GRN-9", problem: "No exchange rate for EUR on 2026-09-20" }],
    posted_value_30d: 1000, no_cost_30d: 1, last_posted_at: null };
  m.tables = {
    fiscal_years: [{ id: "fy1", year_name: "FY 2026/27", fiscal_year: 2027, start_date: "2026-04-01", end_date: "2027-03-31", status: "open", is_current: true }],
    accounting_periods: [period(3, "Jun", "open"), period(2, "May", "closed"), period(1, "Apr", "closed")],
  };
});

describe("Accounting periods", () => {
  it("offers Close only on the earliest open period and Reopen only on the latest closed one", async () => {
    const user = userEvent.setup();
    wrap(<AccountingPeriodsTab />);
    const jun = (await screen.findByText("Jun 2026")).closest("div.flex.items-center.justify-between") as HTMLElement;
    const may = screen.getByText("May 2026").closest("div.flex.items-center.justify-between") as HTMLElement;
    const apr = screen.getByText("Apr 2026").closest("div.flex.items-center.justify-between") as HTMLElement;
    expect(within(jun).getByRole("button", { name: "Close Period" })).toBeInTheDocument();
    expect(within(may).getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(within(apr).queryByRole("button")).not.toBeInTheDocument();

    await user.click(within(jun).getByRole("button", { name: "Close Period" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close period" }));
    expect(calls("close_accounting_period")).toEqual([{ p_period_id: "p3" }]);
  });

  it("reopening needs a reason", async () => {
    const user = userEvent.setup();
    wrap(<AccountingPeriodsTab />);
    await user.click(await screen.findByRole("button", { name: "Reopen" }));
    const dialog = screen.getByRole("dialog");
    const go = within(dialog).getByRole("button", { name: "Reopen" });
    expect(go).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/reason/i), "Late supplier invoice");
    await user.click(go);
    expect(calls("reopen_accounting_period")).toEqual([{ p_period_id: "p2", p_reason: "Late supplier invoice" }]);
  });

  it("a new year follows on from the last one", async () => {
    const user = userEvent.setup();
    wrap(<AccountingPeriodsTab />);
    await user.click(await screen.findByRole("button", { name: /new fiscal year/i }));
    const start = screen.getByLabelText(/starts on/i);
    expect(start).toHaveValue("2027-04-01");
    expect(start).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Open year" }));
    expect(calls("open_fiscal_year")).toEqual([{ p_company_id: "co", p_start_date: "2027-04-01", p_name: null }]);
  });

  it("shows what stock is waiting and why, and posts on demand", async () => {
    const user = userEvent.setup();
    wrap(<AccountingPeriodsTab />);
    expect(await screen.findByText(/3 movement\(s\) waiting/)).toBeInTheDocument();
    expect(screen.getByText(/GRN-9: No exchange rate for EUR/)).toBeInTheDocument();
    expect(screen.getByText(/1 movement\(s\) in the last 30 days had no cost/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /post now/i }));
    expect(calls("post_stock_to_ledger")).toEqual([{ p_company_id: "co" }]);
  });

  it("says how to set up stock posting when it isn't", async () => {
    m.stock = { configured: false, start_date: null, pending: 0, pending_value: 0, problems: [], posted_value_30d: 0, no_cost_30d: 0, last_posted_at: null };
    wrap(<AccountingPeriodsTab />);
    expect(await screen.findByText(/Not set up: choose the inventory accounts/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post now/i })).toBeDisabled();
  });
});

const order = (patch: Partial<RentalOrder>): RentalOrder => ({
  id: "r1", rental_number: "RO-1", customer_id: "c1", status: "approved", booking_date: "2026-09-20", pickup_date: "2026-09-25", due_date: "2026-09-28",
  actual_return_date: null, rental_total: 10000, deposit_total: 5000, discount_amount: 1000, tax_amount: 0, late_fee: 0, damage_fee: 0, deposit_refund: 0,
  total_amount: 9000, pending_approval: false, approved_by: null, approved_date: null, approval_comments: null, checked_out_by: null, checked_out_at: null,
  returned_by: null, returned_at: null, notes: null, company_id: "co", created_by: null, created_at: "", updated_at: "",
  deposit_received: 0, deposit_applied: 0, deposit_refunded: 0, ...patch,
});

describe("Rental billing", () => {
  it("records the deposit still due, and no more", async () => {
    m.tables = { customer_invoices: [] };
    const user = userEvent.setup();
    wrap(<RentalBillingCard order={order({ deposit_received: 2000 })} />);
    expect(screen.getByText(/invoiced when it is checked out/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /record deposit/i }));
    const amount = screen.getByLabelText(/amount/i);
    expect(amount).toHaveValue(3000);
    const save = within(screen.getByRole("dialog")).getByRole("button", { name: /record deposit/i });
    await user.clear(amount);
    await user.type(amount, "3500");
    expect(save).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, "3000");
    await user.click(save);
    expect(calls("record_rental_deposit")[0]).toMatchObject({ p_order_id: "r1", p_amount: 3000, p_bank_account_id: "b1", p_method: "cash" });
  });

  it("settling pays the open invoices first and refunds the rest", async () => {
    m.tables = { customer_invoices: [
      { id: "i1", invoice_number: "INV-1", status: "posted", gross_amount: 9000, tax_amount: 0, amount_received: 9000 },
      { id: "i2", invoice_number: "INV-2", status: "draft", gross_amount: 2000, tax_amount: 0, amount_received: 0 },
    ] };
    const user = userEvent.setup();
    wrap(<RentalBillingCard order={order({ status: "returned", deposit_received: 5000, charges_invoice_id: "i2", late_fee: 1500, damage_fee: 500 })} />);
    expect(await screen.findByText("Late / damage fees")).toBeInTheDocument();
    expect(screen.getByText(/Deposit held/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /settle deposit/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/pays the rental's open invoices/)).toHaveTextContent(/2,000.*and.*3,000.*refunded/);
    await user.click(within(dialog).getByRole("button", { name: "Settle" }));
    expect(calls("settle_rental_deposit")[0]).toMatchObject({ p_order_id: "r1", p_bank_account_id: "b1" });
  });
});
