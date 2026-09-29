import type { BomItem } from "@/types/bom";

export interface BomPrLine {
  warehouse_item_id: string | null;
  finished_good_id: null;
  item_code: string;
  item_name: string;
  description: string;
  quantity: number;
  unit_of_measure: string;
  estimated_unit_price: number;
  estimated_total_price: number;
  specifications: string;
  notes: string;
}

/**
 * Requisition lines for making `units` of a BOM's product. Per-unit usage is the
 * item's consumption, or its quantity when no consumption is set (the same rule
 * as material demand planning).
 */
export function bomLinesForPr(items: Pick<BomItem, "item_name" | "item_code" | "description" | "quantity" | "consumption" | "unit_of_measure" | "unit_cost" | "warehouse_item_id">[], units: number, bomNumber: string): BomPrLine[] {
  return items
    .map((i) => {
      const perUnit = Number(i.consumption) || Number(i.quantity) || 0;
      const quantity = Math.round(perUnit * units * 1000) / 1000;
      const price = Number(i.unit_cost) || 0;
      return {
        warehouse_item_id: i.warehouse_item_id ?? null,
        finished_good_id: null,
        item_code: i.item_code ?? "",
        item_name: i.item_name,
        description: i.description ?? "",
        quantity,
        unit_of_measure: i.unit_of_measure || "pcs",
        estimated_unit_price: price,
        estimated_total_price: Math.round(quantity * price * 100) / 100,
        specifications: "",
        notes: `From ${bomNumber} × ${units}`,
      };
    })
    .filter((l) => l.quantity > 0);
}
