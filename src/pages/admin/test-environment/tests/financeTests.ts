import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const tableReadTest = (id: string, name: string, table: string, priority: "critical" | "high" | "medium" = "high"): TestCase => ({
  id, name, category: "Finance", priority, description: `Verify ${table} table is accessible`, status: "idle",
  run: async () => {
    const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    if (error) return { passed: false, error: error.message };
    return { passed: true, details: "Table accessible" };
  },
});

export const financeTests: TestCase[] = [
  tableReadTest("FN-001", "Chart of Accounts Access", "chart_of_accounts", "critical"),
  tableReadTest("FN-002", "Journal Entries Access", "journal_entries", "critical"),
  tableReadTest("FN-003", "Journal Entry Lines Access", "journal_entry_lines"),
  tableReadTest("FN-004", "Bank Accounts Access", "bank_accounts"),
  tableReadTest("FN-005", "Bank Transactions Access", "bank_transactions"),
  tableReadTest("FN-006", "Bank Reconciliations Access", "bank_reconciliations"),
  tableReadTest("FN-007", "Customer Invoices Access", "customer_invoices"),
  tableReadTest("FN-008", "Vendor Invoices Access", "vendor_invoices"),
  tableReadTest("FN-009", "Budgets Access", "budgets"),
  tableReadTest("FN-010", "Cost Centers Access", "cost_centers"),
  tableReadTest("FN-011", "Accounting Periods Access", "accounting_periods"),
  tableReadTest("FN-012", "Bad Debt Provisions Access", "bad_debt_provisions"),
  tableReadTest("FN-013", "Asset Disposals Access", "asset_disposals"),
  {
    id: "FN-014", name: "GL Account Count", category: "Finance", priority: "medium",
    description: "Count chart of accounts entries", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("chart_of_accounts").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `GL accounts: ${count ?? 0}` };
    },
  },
];
