import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const tableReadTest = (id: string, name: string, table: string, priority: "critical" | "high" | "medium" = "high"): TestCase => ({
  id, name, category: "Sales (TUH)", priority, description: `Verify ${table} table is accessible`, status: "idle",
  run: async () => {
    const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    if (error) return { passed: false, error: error.message };
    return { passed: true, details: "Table accessible" };
  },
});

export const salesTests: TestCase[] = [
  tableReadTest("SL-001", "Customers Access", "customers", "critical"),
  tableReadTest("SL-002", "Customer PO Access", "customer_purchase_orders", "critical"),
  tableReadTest("SL-003", "Customer PO Items Access", "customer_po_items"),
  tableReadTest("SL-004", "Finished Goods Access", "finished_goods_inventory"),
  tableReadTest("SL-005", "Customer Invoices Access", "customer_invoices"),
  {
    id: "SL-006", name: "Customer Count", category: "Sales (TUH)", priority: "medium",
    description: "Count customers in system", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("customers").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Customers: ${count ?? 0}` };
    },
  },
];
