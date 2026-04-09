import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

export const managementTests: TestCase[] = [
  {
    id: "MG-001", name: "Companies Access", category: "Management", priority: "critical",
    description: "Verify companies table is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("companies").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "Table accessible" };
    },
  },
  {
    id: "MG-002", name: "Roles Access", category: "Management", priority: "critical",
    description: "Verify roles table is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("roles").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "Table accessible" };
    },
  },
  {
    id: "MG-003", name: "Audit Logs Access", category: "Management", priority: "high",
    description: "Verify audit_logs table is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("audit_logs" as any).select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "Table accessible" };
    },
  },
  {
    id: "MG-004", name: "Approval Console Access", category: "Management", priority: "high",
    description: "Verify approval_stages table is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("approval_stages").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "Table accessible" };
    },
  },
  {
    id: "MG-005", name: "Budgets Access", category: "Management", priority: "high",
    description: "Verify budgets table is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("budgets").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "Table accessible" };
    },
  },
  {
    id: "MG-006", name: "User Company Access", category: "Management", priority: "high",
    description: "Verify user_company_access table is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("user_company_access").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "Table accessible" };
    },
  },
];
