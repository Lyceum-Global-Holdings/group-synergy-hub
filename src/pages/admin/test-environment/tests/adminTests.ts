import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

export const adminTests: TestCase[] = [
  {
    id: "AD-001", name: "Companies Table Access", category: "Administration", priority: "critical",
    description: "Verify companies table is accessible", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("companies").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Companies: ${count ?? 0}` };
    },
  },
  {
    id: "AD-002", name: "Roles Table Access", category: "Administration", priority: "critical",
    description: "Verify roles table is accessible", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("roles").select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Roles: ${count ?? 0}` };
    },
  },
  {
    id: "AD-003", name: "User Modules Access", category: "Administration", priority: "high",
    description: "Verify user_modules table is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("user_modules" as any).select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "Table accessible" };
    },
  },
  {
    id: "AD-004", name: "Role Modules Access", category: "Administration", priority: "high",
    description: "Verify role_modules table is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("role_modules" as any).select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "Table accessible" };
    },
  },
  {
    id: "AD-005", name: "Profiles Directory Access", category: "Administration", priority: "high",
    description: "Verify profiles_directory view is accessible", status: "idle",
    run: async () => {
      const { error } = await supabase.from("profiles_directory" as any).select("id").limit(1);
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: "View accessible" };
    },
  },
];
