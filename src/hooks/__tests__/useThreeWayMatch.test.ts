import { describe, it, expect } from "vitest";
import { toMatchResult, toMatchStatus } from "@/hooks/useThreeWayMatch";

const row = (patch = {}) => ({
  invoice_id: "i1", invoice_number: "INV-1", invoice_date: "2026-09-20", currency: "LKR", supplier_name: "Alpha",
  po_id: "p1", po_number: "PO-1", grn_numbers: "GRN-1", po_amount: "140000", received_amount: "81000", invoice_amount: "85500",
  stored_status: "pending", computed_status: "exception", decided: false, notes: null,
  lines: [{ po_item_id: "x", item_name: "Cement", item_code: "C-1", unit_of_measure: "bag", po_qty: 100, po_unit_price: 900,
    received_qty: 90, invoiced_before: 0, invoice_qty: 95, invoice_unit_price: 900, qty_status: "over", price_status: "match" }],
  ...patch,
});

describe("three-way match mapping", () => {
  it("maps stored values from older screens and the e-invoice sync", () => {
    expect(["matched", "auto_matched"].map(toMatchStatus)).toEqual(["matched", "matched"]);
    expect(["exception", "mismatch", "partial"].map(toMatchStatus)).toEqual(["exception", "exception", "exception"]);
    expect(toMatchStatus("failed")).toBe("failed");
    expect(toMatchStatus(null)).toBe("pending");
  });

  it("shows the live check until a person decides", () => {
    const live = toMatchResult(row());
    expect(live.status).toBe("exception");
    expect(live.lineItems[0]).toMatchObject({ receivedQty: 90, invoiceQty: 95, qtyCheck: "over", priceCheck: "match" });
    expect(live.variancePercent).toBeCloseTo(-38.93, 1);

    const decided = toMatchResult(row({ decided: true, stored_status: "matched", notes: "Accepted with differences: credit note" }));
    expect(decided.status).toBe("matched");
    expect(decided.computedStatus).toBe("exception");
  });
});
