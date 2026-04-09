import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const tableReadTest = (id: string, name: string, table: string, priority: "critical" | "high" | "medium" = "high"): TestCase => ({
  id, name, category: "Procurement", priority, description: `Verify ${table} table is accessible`, status: "idle",
  run: async () => {
    const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    if (error) return { passed: false, error: error.message };
    return { passed: true, details: "Table accessible" };
  },
});

export const procurementTests: TestCase[] = [
  tableReadTest("PR-001", "Purchase Requisitions Access", "purchase_requisitions", "critical"),
  tableReadTest("PR-002", "Purchase Orders Access", "purchase_orders", "critical"),
  tableReadTest("PR-003", "PO Line Items Access", "purchase_order_items"),
  tableReadTest("PR-004", "RFQ Access", "rfq_rfp"),
  tableReadTest("PR-005", "Bill of Materials Access", "bill_of_materials"),
  tableReadTest("PR-006", "BOM Components Access", "bom_components"),
  tableReadTest("PR-007", "Blanket PO Access", "blanket_purchase_orders"),
  tableReadTest("PR-008", "Three-Way Match Access", "three_way_matches"),
  tableReadTest("PR-009", "PO Amendments Access", "po_amendments"),
  tableReadTest("PR-010", "Approval Stages Access", "approval_stages"),
  tableReadTest("PR-011", "Material Demand Planning Access", "material_demand_plans"),
  {
    id: "PR-012", name: "PO Count Check", category: "Procurement", priority: "medium",
    description: "Count purchase orders in system", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("purchase_orders").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Purchase orders: ${count ?? 0}` };
    },
  },
];
