import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

export const authTests: TestCase[] = [
  {
    id: "AUTH-001",
    name: "Session Active",
    category: "Authentication",
    priority: "critical",
    description: "Verify current user has an active session",
    status: "idle",
    run: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) return { passed: false, error: error.message };
      if (!session) return { passed: false, error: "No active session found" };
      return { passed: true, details: `User: ${session.user.email}` };
    },
  },
  {
    id: "AUTH-002",
    name: "User Metadata Accessible",
    category: "Authentication",
    priority: "critical",
    description: "Verify auth.getUser() returns valid user data",
    status: "idle",
    run: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) return { passed: false, error: error.message };
      if (!user) return { passed: false, error: "No user returned" };
      return { passed: true, details: `ID: ${user.id}, Email: ${user.email}` };
    },
  },
  {
    id: "AUTH-003",
    name: "Super Admin RPC",
    category: "Authentication",
    priority: "critical",
    description: "Verify is_super_admin RPC function works",
    status: "idle",
    run: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { passed: false, error: "Not authenticated" };
      const { data, error } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `is_super_admin: ${data}` };
    },
  },
  {
    id: "AUTH-004",
    name: "Profile Accessible",
    category: "Authentication",
    priority: "high",
    description: "Verify profiles table returns current user profile",
    status: "idle",
    run: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { passed: false, error: "Not authenticated" };
      const { data, error } = await supabase.from("profiles").select("id, first_name, email").eq("id", user.id).maybeSingle();
      if (error) return { passed: false, error: error.message };
      if (!data) return { passed: false, error: "No profile found" };
      return { passed: true, details: `Profile: ${data.first_name || data.email}` };
    },
  },
  {
    id: "AUTH-005",
    name: "User Roles Accessible",
    category: "Authentication",
    priority: "high",
    description: "Verify user_roles table is queryable",
    status: "idle",
    run: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { passed: false, error: "Not authenticated" };
      const { data, error } = await supabase.from("user_roles").select("id, role_id").eq("user_id", user.id);
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Roles assigned: ${data?.length || 0}` };
    },
  },
  {
    id: "AUTH-006",
    name: "Token Refresh",
    category: "Authentication",
    priority: "medium",
    description: "Verify session can be refreshed",
    status: "idle",
    run: async () => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return { passed: false, error: error.message };
      if (!data.session) return { passed: false, error: "Refresh returned no session" };
      return { passed: true, details: "Token refreshed successfully" };
    },
  },
];
