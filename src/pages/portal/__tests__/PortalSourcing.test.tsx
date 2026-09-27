import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  role: "user",
  rfqs: [] as any[],
  quotes: [] as any[],
  submitInvoice: vi.fn(async () => "inv-1"),
}));

vi.mock("@/contexts/SupplierContext", () => ({
  useSupplierContext: () => ({ activeSupplierId: "s1", activeMembership: { portal_role: m.role } }),
}));
vi.mock("@/hooks/usePortalSourcing", () => ({
  usePortalRfqs: () => ({ data: m.rfqs, isLoading: false }),
  usePortalQuotes: () => ({ data: m.quotes, isLoading: false }),
  useSubmitInvoice: () => ({ mutateAsync: m.submitInvoice, isPending: false }),
}));
vi.mock("@/hooks/useRfqWorkflow", () => ({ useSubmitQuote: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

import PortalQuotes from "@/pages/portal/PortalQuotes";
import { SubmitInvoiceDialog } from "@/components/portal/SubmitInvoiceDialog";
import { renderWithRouter } from "@/test/renderWithRouter";

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const rfq = (id: string, status: string, deadline: string) => ({
  invitation_status: "invited",
  request: { id, request_number: `RFQ-${id}`, title: `Request ${id}`, status, submission_deadline: deadline, currency: "LKR", items: [] },
});

describe("Portal quotes", () => {
  beforeEach(() => {
    m.role = "user";
    m.rfqs = [rfq("open", "published", inDays(3)), rfq("late", "published", inDays(-1)), rfq("done", "awarded", inDays(-5))];
    m.quotes = [];
  });

  it("lets suppliers quote only on open requests before the deadline", () => {
    renderWithRouter(<PortalQuotes />);
    expect(screen.getAllByRole("button", { name: /submit quote/i })).toHaveLength(1);
  });

  it("offers an update while the quote is still editable", () => {
    m.quotes = [{ id: "q", request_id: "open", status: "submitted", quote_number: "QT-1", total_quoted_amount: 100, currency: "LKR" }];
    renderWithRouter(<PortalQuotes />);
    expect(screen.getByRole("button", { name: /update quote/i })).toBeInTheDocument();
  });

  it("viewers can look but not quote", () => {
    m.role = "viewer";
    renderWithRouter(<PortalQuotes />);
    expect(screen.queryByRole("button", { name: /submit quote/i })).not.toBeInTheDocument();
    expect(screen.getByText(/can view requests but not submit/i)).toBeInTheDocument();
  });
});

describe("SubmitInvoiceDialog", () => {
  // Radix Select needs pointer-capture and scrolling APIs that jsdom lacks.
  beforeAll(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });

  it("starts from the PO lines and submits the totals", async () => {
    const user = userEvent.setup();
    const pos = [{
      id: "po1", po_number: "PO-1", po_date: "2026-09-20", status: "sent", currency: "LKR", final_amount: 138000, total_amount: 138000,
      items: [{ id: "l1", item_name: "Cement", item_code: "C-1", quantity_ordered: 100, unit_of_measure: "bag", unit_price: 880 }],
    }];
    renderWithRouter(<SubmitInvoiceDialog open onOpenChange={() => {}} purchaseOrders={pos} />);

    await user.click(screen.getByRole("combobox", { name: /purchase order/i }));
    await user.click(await screen.findByRole("option", { name: /PO-1/ }));
    expect(screen.getByLabelText(/line 1 description/i)).toHaveValue("C-1 · Cement");

    await user.type(screen.getByLabelText(/your invoice number/i), "INV-77");
    await user.clear(screen.getByLabelText(/tax/i));
    await user.type(screen.getByLabelText(/tax/i), "13200");
    expect(screen.getByText("LKR 101,200.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /submit invoice/i }));
    await waitFor(() => expect(m.submitInvoice).toHaveBeenCalled());
    expect(m.submitInvoice.mock.calls[0][0]).toMatchObject({
      poId: "po1",
      invoiceNumber: "INV-77",
      lines: [{ description: "C-1 · Cement", quantity: 100, unit_price: 880 }],
      taxAmount: 13200,
    });
  });
});
