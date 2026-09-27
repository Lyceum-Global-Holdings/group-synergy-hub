import { describe, it, expect } from "vitest";
import { describeAmendment, emptyAmendmentDraft, planAmendment } from "@/components/procurement/amendmentChanges";
import type { PoItem } from "@/types/purchaseOrder";

const item = (id: string, name: string, qty: number, price: number, received = 0): PoItem => ({
  id, po_id: "po", item_name: name, quantity_ordered: qty, quantity_received: received, quantity_pending: qty - received,
  unit_price: price, total_price: qty * price, unit_of_measure: "bag",
});
const items = [item("a", "Cement", 100, 900, 20), item("b", "Sand", 10, 5000)];
const po = { expected_delivery_date: "2026-10-01", payment_terms: "Net 30", delivery_terms: "DAP" };
const draft = (patch = {}) => ({ ...emptyAmendmentDraft(po), ...patch });

describe("planAmendment", () => {
  it("builds a price change and the new total, skipping unchanged lines", () => {
    const plan = planAmendment("price_change", draft({ lineValues: { a: "950", b: "5000" } }), items, po);
    expect(plan.problem).toBeNull();
    expect(plan.changes).toEqual({ lines: [{ po_item_id: "a", unit_price: 950 }] });
    expect(plan.newTotal).toBe(145000);
  });

  it("needs at least one real change", () => {
    expect(planAmendment("price_change", draft(), items, po).problem).toMatch(/at least one line/);
    expect(planAmendment("price_change", draft({ lineValues: { a: "900" } }), items, po).problem).toMatch(/at least one line/);
  });

  it("won't take a quantity below what was received", () => {
    expect(planAmendment("quantity_change", draft({ lineValues: { a: "10" } }), items, po).problem).toMatch(/already been received/);
    const ok = planAmendment("quantity_change", draft({ lineValues: { a: "50" } }), items, po);
    expect(ok.changes).toEqual({ lines: [{ po_item_id: "a", quantity: 50 }] });
    expect(ok.newTotal).toBe(95000);
  });

  it("removes only unreceived lines and never all of them", () => {
    expect(planAmendment("item_removal", draft({ removeIds: ["a"] }), items, po).problem).toMatch(/already been received/);
    expect(planAmendment("item_removal", draft({ removeIds: ["a", "b"] }), items, po).problem).toMatch(/at least one line/);
    expect(planAmendment("item_removal", draft({ removeIds: ["b"] }), items, po)).toEqual({
      changes: { lines: [{ po_item_id: "b" }] }, problem: null, newTotal: 90000,
    });
  });

  it("adds lines with a default unit", () => {
    const plan = planAmendment("item_addition", draft({
      newLines: [{ item_name: "Cable", item_code: "", quantity: "5", unit_price: "200", unit_of_measure: "" }],
    }), items, po);
    expect(plan.changes).toEqual({ lines: [{ item_name: "Cable", item_code: null, quantity: 5, unit_price: 200, unit_of_measure: "pcs" }] });
    expect(plan.newTotal).toBe(141000);
    expect(planAmendment("item_addition", draft({ newLines: [{ item_name: "", item_code: "", quantity: "1", unit_price: "1", unit_of_measure: "" }] }), items, po).problem)
      .toMatch(/Name each/);
  });

  it("changes delivery date and terms only when they differ", () => {
    expect(planAmendment("delivery_date_change", draft({ deliveryDate: "2026-10-01" }), items, po).problem).toMatch(/same as now/);
    expect(planAmendment("delivery_date_change", draft({ deliveryDate: "2026-11-15" }), items, po).changes).toEqual({ expected_delivery_date: "2026-11-15" });
    expect(planAmendment("terms_change", draft(), items, po).problem).toMatch(/Change the payment/);
    expect(planAmendment("terms_change", draft({ paymentTerms: "Net 60" }), items, po).changes).toEqual({ payment_terms: "Net 60", delivery_terms: "DAP" });
  });

  it("records 'other' without a change", () => {
    expect(planAmendment("other", draft(), items, po)).toEqual({ changes: null, problem: null, newTotal: null });
  });
});

describe("describeAmendment", () => {
  it("reads stored before/after values", () => {
    expect(describeAmendment("price_change",
      { lines: [{ po_item_id: "a", item_name: "Cement", unit_price: 900 }] },
      { lines: [{ po_item_id: "a", item_name: "Cement", unit_price: 950 }] })).toEqual(["Cement: price 900 → 950"]);
    expect(describeAmendment("terms_change", { payment_terms: "Net 30", delivery_terms: "DAP" }, { payment_terms: "Net 60", delivery_terms: "DAP" }))
      .toEqual(["Payment terms: Net 30 → Net 60"]);
    expect(describeAmendment("price_change", null, null)).toEqual([]);
  });
});
