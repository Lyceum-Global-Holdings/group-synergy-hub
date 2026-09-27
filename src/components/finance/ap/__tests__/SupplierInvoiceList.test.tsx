import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const m = vi.hoisted(() => ({ select: vi.fn() }));
const rows = [
  { id: "1", invoice_number: "INV-100", invoice_date: "2026-09-25", due_date: "2026-10-25", gross_amount: 103840, status: "pending_approval",
    source: "peppol", three_way_match_status: "matched", po_id: "po", supplier: { name: "Alpha Supplies" } },
  { id: "2", invoice_number: "X-7", invoice_date: "2026-09-26", due_date: "2026-10-26", gross_amount: 500, status: "pending_approval",
    source: "peppol", three_way_match_status: "pending", po_id: null, supplier: null },
  { id: "3", invoice_number: "P-1", invoice_date: "2026-09-20", due_date: "2026-10-20", gross_amount: 100, status: "approved",
    source: "portal", three_way_match_status: "mismatch", po_id: "po", supplier: { name: "Beta Traders" } },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (cols: string) => {
        m.select(cols);
        return { eq: () => ({ order: async () => ({ data: rows, error: null }) }) };
      },
    }),
  },
}));
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co" } }) }));
vi.mock("@/hooks/useGLSettings", () => ({ useGLSettings: () => ({ currencySymbol: "Rs" }) }));

import { SupplierInvoiceList } from "@/components/finance/ap/SupplierInvoiceList";

describe("SupplierInvoiceList", () => {
  it("lists invoices with their supplier, source and match", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><SupplierInvoiceList /></QueryClientProvider>);
    expect(await screen.findByText("INV-100")).toBeInTheDocument();
    expect(m.select).toHaveBeenCalledWith(expect.stringContaining("suppliers(name)"));
    expect(screen.getByText("Alpha Supplies")).toBeInTheDocument();
    expect(screen.getAllByText("PEPPOL e-invoice")).toHaveLength(2);
    expect(screen.getByText("Supplier portal")).toBeInTheDocument();
    expect(screen.getByText("Supplier not recognised")).toBeInTheDocument();
    expect(screen.getByText("Matched")).toBeInTheDocument();
    expect(screen.getByText("Mismatch")).toBeInTheDocument();
    expect(screen.getByText("No PO")).toBeInTheDocument();
  });
});
