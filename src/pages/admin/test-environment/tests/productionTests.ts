import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const tableReadTest = (id: string, name: string, table: string, priority: "critical" | "high" | "medium" = "high"): TestCase => ({
  id, name, category: "Production", priority, description: `Verify ${table} table is accessible`, status: "idle",
  run: async () => {
    const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    if (error) return { passed: false, error: error.message };
    return { passed: true, details: "Table accessible" };
  },
});

export const productionTests: TestCase[] = [
  tableReadTest("PD-001", "Production Sectors Access", "production_sectors", "critical"),
  tableReadTest("PD-002", "Production Stages Access", "production_stages", "critical"),
  tableReadTest("PD-003", "Production Orders Access", "production_orders"),
  tableReadTest("PD-004", "Production Daily Entries Access", "production_daily_entries"),
  tableReadTest("PD-005", "Production Stage Costs Access", "production_stage_costs"),
  tableReadTest("PD-006", "Production Efficiency Access", "production_efficiency_logs"),
  tableReadTest("PD-007", "Product Master Access", "product_master"),
  {
    id: "PD-008", name: "Production Order Count", category: "Production", priority: "medium",
    description: "Count production orders", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("production_orders" as any).select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Production orders: ${count ?? 0}` };
    },
  },
];
