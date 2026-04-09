import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const tableReadTest = (id: string, name: string, table: string, priority: "critical" | "high" | "medium" = "high"): TestCase => ({
  id, name, category: "Sourcing", priority, description: `Verify ${table} table is accessible`, status: "idle",
  run: async () => {
    const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    if (error) return { passed: false, error: error.message };
    return { passed: true, details: "Table accessible" };
  },
});

export const sourcingTests: TestCase[] = [
  tableReadTest("SR-001", "Suppliers Access", "suppliers", "critical"),
  tableReadTest("SR-002", "Supplier Evaluations Access", "supplier_evaluations"),
  tableReadTest("SR-003", "Supplier Contracts Access", "supplier_contracts"),
  tableReadTest("SR-004", "Supplier Blacklist Access", "supplier_blacklist"),
  tableReadTest("SR-005", "Supplier Allocations Access", "supplier_allocations"),
  tableReadTest("SR-006", "Blacklist Reviews Access", "blacklist_reviews"),
  tableReadTest("SR-007", "Supplier Registrations Access", "supplier_registrations"),
  {
    id: "SR-008", name: "Supplier Count", category: "Sourcing", priority: "medium",
    description: "Count suppliers in system", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("suppliers").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Suppliers: ${count ?? 0}` };
    },
  },
];
