import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  submitQuote: vi.fn(async () => "quote-1"),
  award: vi.fn(),
  rfq: null as any,
  rfqs: [] as any[],
}));

vi.mock("@/hooks/useRfqWorkflow", () => ({
  useSubmitQuote: () => ({ mutateAsync: m.submitQuote, isPending: false }),
  useAwardRfq: () => ({ mutate: m.award, isPending: false }),
}));
vi.mock("@/hooks/useRfqRfp", () => ({
  useRfqRfpRequest: () => ({ data: m.rfq, isLoading: false }),
  useRfqRfpRequests: () => ({ data: m.rfqs }),
}));
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co" } }) }));
vi.mock("@/components/management/reports/GenerateReportButton", () => ({ GenerateReportButton: () => null }));

import { QuoteEntryDialog } from "@/components/sourcing/rfq/QuoteEntryDialog";
import QuotationComparison from "@/pages/sourcing/QuotationComparison";
import { renderWithRouter } from "@/test/renderWithRouter";

const items = [
  { id: "i1", request_id: "r1", line_number: 1, item_name: "Cement 50kg", item_code: "C-1", quantity: 100, unit_of_measure: "bag" },
  { id: "i2", request_id: "r1", line_number: 2, item_name: "Sand", quantity: 10, unit_of_measure: "cube" },
];
const quote = (id: string, supplier: string, total: number, prices: Record<string, number>, status = "submitted") => ({
  id, request_id: "r1", supplier_id: `s-${id}`, quote_number: `QT-${id}`, status, total_quoted_amount: total, currency: "LKR",
  validity_period: 30, created_at: "", updated_at: "", submission_date: "",
  supplier: { id: `s-${id}`, name: supplier },
  items: Object.entries(prices).map(([rfq_item_id, unit_price], n) => ({
    quote_id: id, rfq_item_id, line_number: n + 1, unit_price, total_price: unit_price * (rfq_item_id === "i1" ? 100 : 10),
  })),
});

describe("QuoteEntryDialog", () => {
  beforeEach(() => m.submitQuote.mockClear());

  it("submits only the priced lines' values and computes the total", async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <QuoteEntryDialog open onOpenChange={() => {}} supplierId="s1"
        rfq={{ id: "r1", request_number: "RFQ-1", title: "Cement", currency: "LKR", items: items as any }} />,
    );
    const submit = screen.getByRole("button", { name: /submit quote/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/unit price for cement/i), "900");
    await user.type(screen.getByLabelText(/delivery days for cement/i), "5");
    expect(screen.getByText(/1 of 2 items priced/i)).toBeInTheDocument();
    expect(screen.getAllByText("LKR 90,000.00").length).toBeGreaterThan(0);

    await user.click(submit);
    await waitFor(() => expect(m.submitQuote).toHaveBeenCalled());
    const input = m.submitQuote.mock.calls[0][0];
    expect(input.lines).toEqual([
      { rfq_item_id: "i1", unit_price: 900, delivery_days: 5, notes: "" },
      { rfq_item_id: "i2", unit_price: null, delivery_days: null, notes: "" },
    ]);
    expect(input.validityDays).toBe(30);
  });

  it("prefills an existing quote for updating", () => {
    renderWithRouter(
      <QuoteEntryDialog open onOpenChange={() => {}} supplierId="s1" existing={quote("q1", "Alpha", 140000, { i1: 900, i2: 5000 }) as any}
        rfq={{ id: "r1", request_number: "RFQ-1", title: "Cement", currency: "LKR", items: items as any }} />,
    );
    expect(screen.getByLabelText(/unit price for sand/i)).toHaveValue("5000");
    expect(screen.getByRole("button", { name: /update quote/i })).toBeEnabled();
  });
});

describe("QuotationComparison", () => {
  beforeEach(() => {
    m.award.mockClear();
    m.rfq = {
      id: "r1", request_number: "RFQ-1", title: "Cement", status: "evaluation", currency: "LKR",
      items, quotes: [quote("a", "Alpha", 138000, { i1: 880, i2: 5000 }), quote("b", "Beta", 145000, { i1: 850, i2: 6000 }), quote("c", "Gamma", 85000, { i1: 850 })],
    };
    m.rfqs = [m.rfq];
  });

  it("marks the lowest complete quote and the lowest price per item", () => {
    renderWithRouter(<QuotationComparison />, { route: "/sourcing/quotation-comparison?rfq=r1" });
    const alpha = screen.getByText("Alpha", { selector: "div" }).closest("div.flex-col") as HTMLElement;
    expect(within(alpha).getByText(/lowest complete quote/i)).toBeInTheDocument();
    // Gamma is cheapest overall but only priced 1 of 2 items.
    expect(screen.getByText(/1 of 2 items priced/i)).toBeInTheDocument();
    // Cement: Beta and Gamma tie at 850, both highlighted.
    expect(screen.getAllByText("LKR 850.00").every((el) => el.className.includes("emerald"))).toBe(true);
  });

  it("awards with a draft PO by default", async () => {
    const user = userEvent.setup();
    renderWithRouter(<QuotationComparison />, { route: "/sourcing/quotation-comparison?rfq=r1" });
    const alpha = screen.getByText("Alpha", { selector: "div" }).closest("div.flex-col") as HTMLElement;
    await user.click(within(alpha).getByRole("button", { name: /award to this supplier/i }));
    expect(await screen.findByText(/award to alpha/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("button", { name: /^award$/i }));
    expect(m.award).toHaveBeenCalledWith({ quoteId: "a", createPo: true }, expect.anything());
  });

  it("offers no award once the RFQ is awarded", () => {
    m.rfq.status = "awarded";
    renderWithRouter(<QuotationComparison />, { route: "/sourcing/quotation-comparison?rfq=r1" });
    expect(screen.queryByRole("button", { name: /award to this supplier/i })).not.toBeInTheDocument();
  });
});
