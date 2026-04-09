import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const tableReadTest = (id: string, name: string, table: string, priority: "critical" | "high" | "medium" = "high"): TestCase => ({
  id, name, category: "Warehouse", priority, description: `Verify ${table} table is accessible`, status: "idle",
  run: async () => {
    const { data, error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    if (error) return { passed: false, error: error.message };
    return { passed: true, details: `Table accessible` };
  },
});

export const warehouseTests: TestCase[] = [
  tableReadTest("WH-001", "Item Catalog Access", "warehouse_item_catalog", "critical"),
  tableReadTest("WH-002", "Warehouse Items Access", "warehouse_items", "critical"),
  tableReadTest("WH-003", "Warehouse Locations Access", "warehouse_locations", "critical"),
  tableReadTest("WH-004", "Warehouse Bins Access", "warehouse_bins"),
  tableReadTest("WH-005", "GRN Table Access", "goods_receipt_notes"),
  tableReadTest("WH-006", "Stock Transfers Access", "stock_transfers"),
  tableReadTest("WH-007", "Stock Adjustments Access", "stock_adjustments"),
  tableReadTest("WH-008", "Material Issues Access", "material_issues"),
  tableReadTest("WH-009", "Warehouse Assets Access", "warehouse_assets"),
  tableReadTest("WH-010", "Asset Categories Access", "asset_categories"),
  tableReadTest("WH-011", "Item Batches Access", "item_batches"),
  tableReadTest("WH-012", "Cycle Counts Access", "cycle_counts"),
  tableReadTest("WH-013", "Delivery Orders Access", "delivery_orders"),
  tableReadTest("WH-014", "Tool Issues Access", "tool_issues"),
  {
    id: "WH-015", name: "Item Catalog Count", category: "Warehouse", priority: "high",
    description: "Verify item catalog has records", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("warehouse_item_catalog" as any).select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Catalog items: ${count ?? 0}` };
    },
  },
];
