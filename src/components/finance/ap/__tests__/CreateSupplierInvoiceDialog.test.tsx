import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const m = vi.hoisted(() => ({ rpc: vi.fn(async () => "inv-1"), insert: vi.fn(async () => ({ error: null })) }));

const tables: Record<string, unknown[]> = {
  suppliers: [{ id: "s1", name: "Alpha" }],
  purchase_orders: [{
    id: "po1", po_number: "PO-0001", status: "sent", currency: "LKR", payment_terms: "Net 30",
    items: [
      { id: "i1", item_code: "C-1", item_name: "Cement", quantity_ordered: 100, quantity_received: 90, unit_price: 900, unit_of_measure: "bag" },
      { id: "i2", item_code: null, item_name: "Sand", quantity_ordered: 10, quantity_received: 0, unit_price: 5000, unit_of_measure: "cube" },
    ],
  }],
};

// A chainable query that resolves to the table's rows.
const query = (table: string) => {
  const q: any = {
    select: () => q, eq: () => q, in: () => q, order: () => q,
    insert: (row: unknown) => m.insert(row),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: tables[table] ?? [], error: null }),
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => query(t) } }));
vi.mock("@/lib/untypedRpc", () => ({ untypedRpc: m.rpc }));
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co" } }) }));
vi.mock("@/hooks/finance/usePaymentTerms", () => ({ usePaymentTerms: () => ({ paymentTerms: [] }) }));
vi.mock("@/hooks/finance/useCurrencies", () => ({ useCurrencies: () => ({ currencies: [], exchangeRates: [] }) }));
vi.mock("@/hooks/finance/useTaxTemplates", () => ({ useTaxTemplates: () => ({ taxTemplates: [], taxDetails: [] }) }));

import { CreateSupplierInvoiceDialog } from "@/components/finance/ap/CreateSupplierInvoiceDialog";
import { paymentBlockReason } from "@/hooks/finance/usePaymentAllocation";

// jsdom lacks the pointer-capture API Radix Select uses.
Object.assign(window.HTMLElement.prototype, {
  hasPointerCapture: () => false,
  releasePointerCapture: () => {},
});

const renderDialog = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><CreateSupplierInvoiceDialog open onOpenChange={() => {}} /></QueryClientProvider>);
};

describe("CreateSupplierInvoiceDialog", () => {
  beforeEach(() => { m.rpc.mockClear(); m.insert.mockClear(); });

  it("ties a hand-entered invoice to the PO line by line", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("combobox", { name: /supplier/i }));
    await user.click(await screen.findByRole("option", { name: "Alpha" }));
    await user.click(await screen.findByRole("combobox", { name: /purchase order/i }));
    await user.click(await screen.findByRole("option", { name: /PO-0001/ }));

    // Starts from what was received, at the PO price; unreceived lines are left empty.
    expect(await screen.findByLabelText(/invoiced quantity of cement/i)).toHaveValue("90");
    expect(screen.getByLabelText(/invoiced price of cement/i)).toHaveValue("900");
    expect(screen.getByLabelText(/invoiced quantity of sand/i)).toHaveValue("");
    expect(screen.queryByLabelText(/gross amount/i)).not.toBeInTheDocument();
    expect(screen.getByText("81000.00")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/invoice number/i), "SUP-77");
    fireEvent.change(screen.getByLabelText(/invoice date/i), { target: { value: "2026-09-28" } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2026-10-28" } });
    await user.click(screen.getByRole("button", { name: /create invoice/i }));

    await waitFor(() => expect(m.rpc).toHaveBeenCalled());
    expect(m.rpc).toHaveBeenCalledWith("create_supplier_invoice_from_po", expect.objectContaining({
      p_po_id: "po1", p_invoice_number: "SUP-77", p_invoice_date: "2026-09-28", p_due_date: "2026-10-28",
      p_lines: [{ po_item_id: "i1", quantity: 90, unit_price: 900 }], p_tax_amount: 0,
    }));
    expect(m.insert).not.toHaveBeenCalled();
  });
});

describe("paymentBlockReason", () => {
  it("holds back PO invoices until the match is accepted", () => {
    expect(paymentBlockReason({ po_id: null, three_way_match_status: "pending" })).toBeNull();
    expect(paymentBlockReason({ po_id: "p", three_way_match_status: "matched" })).toBeNull();
    expect(paymentBlockReason({ po_id: "p", three_way_match_status: "auto_matched" })).toBeNull();
    expect(paymentBlockReason({ po_id: "p", three_way_match_status: "exception" })).toMatch(/waiting/i);
    expect(paymentBlockReason({ po_id: "p", three_way_match_status: "failed" })).toMatch(/failed/i);
  });
});
