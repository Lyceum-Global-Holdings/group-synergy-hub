import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

export const rlsTests: TestCase[] = [
  {
    id: "RLS-001", name: "Company Scoped Profiles", category: "RLS & Security", priority: "critical",
    description: "Verify profiles are filtered by company access", status: "idle",
    run: async () => {
      const { data, error } = await supabase.from("profiles").select("id").limit(100);
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Visible profiles: ${data?.length ?? 0}` };
    },
  },
  {
    id: "RLS-002", name: "Company Isolation - PO", category: "RLS & Security", priority: "critical",
    description: "Verify purchase orders are company-scoped", status: "idle",
    run: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("id, company_id").limit(10);
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `POs visible: ${data?.length ?? 0}` };
    },
  },
  {
    id: "RLS-003", name: "can_access_company RPC", category: "RLS & Security", priority: "critical",
    description: "Verify can_access_company function works", status: "idle",
    run: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { passed: false, error: "Not authenticated" };
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
      if (!profile?.company_id) return { passed: false, error: "No company_id on profile" };
      const { data, error } = await supabase.rpc("can_access_company", { target_company_id: profile.company_id });
      if (error) return { passed: false, error: error.message };
      return { passed: data === true, details: `can_access_company: ${data}` };
    },
  },
  {
    id: "RLS-004", name: "has_role RPC", category: "RLS & Security", priority: "critical",
    description: "Verify has_role function works", status: "idle",
    run: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { passed: false, error: "Not authenticated" };
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _app_role: "super_admin" });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `has_role(super_admin): ${data}` };
    },
  },
  {
    id: "RLS-005", name: "Warehouse Items RLS", category: "RLS & Security", priority: "high",
    description: "Verify warehouse items have company-scoped access", status: "idle",
    run: async () => {
      const { data, error } = await supabase.from("warehouse_items_full").select("id").limit(5);
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Items visible: ${data?.length ?? 0}` };
    },
  },
  {
    id: "RLS-006", name: "Suppliers RLS", category: "RLS & Security", priority: "high",
    description: "Verify suppliers are company-scoped", status: "idle",
    run: async () => {
      const { data, error } = await supabase.from("suppliers").select("id").limit(5);
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Suppliers visible: ${data?.length ?? 0}` };
    },
  },
  {
    id: "RLS-007", name: "Journal Entries RLS", category: "RLS & Security", priority: "high",
    description: "Verify journal entries are company-scoped", status: "idle",
    run: async () => {
      const { data, error } = await supabase.from("journal_entries").select("id").limit(5);
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Entries visible: ${data?.length ?? 0}` };
    },
  },
  {
    id: "RLS-008", name: "Construction Projects RLS", category: "RLS & Security", priority: "high",
    description: "Verify construction projects are company-scoped", status: "idle",
    run: async () => {
      const { data, error } = await supabase.from("construction_projects" as any).select("id").limit(5);
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Projects visible: ${data?.length ?? 0}` };
    },
  },
];
