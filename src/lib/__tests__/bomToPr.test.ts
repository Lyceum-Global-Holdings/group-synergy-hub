import { describe, it, expect } from "vitest";
import { bomLinesForPr } from "@/lib/bomToPr";

describe("bomLinesForPr", () => {
  it("uses consumption per unit, falls back to quantity, and prices the lines", () => {
    const lines = bomLinesForPr([
      { item_name: "Fabric", item_code: "F-1", quantity: 5, consumption: 1.25, unit_of_measure: "m", unit_cost: 400, warehouse_item_id: "w1" },
      { item_name: "Buttons", quantity: 6, unit_of_measure: "pcs", unit_cost: 2.5 },
      { item_name: "Label", quantity: 0, unit_of_measure: "pcs" },
    ] as any, 40, "BOM-7");
    expect(lines).toHaveLength(2); // nothing to buy for a zero-quantity item
    expect(lines[0]).toMatchObject({ item_name: "Fabric", item_code: "F-1", warehouse_item_id: "w1", quantity: 50, unit_of_measure: "m", estimated_unit_price: 400, estimated_total_price: 20000, notes: "From BOM-7 × 40" });
    expect(lines[1]).toMatchObject({ item_name: "Buttons", quantity: 240, estimated_total_price: 600, warehouse_item_id: null });
  });
});
