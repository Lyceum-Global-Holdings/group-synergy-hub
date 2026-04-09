import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const edgeFnTest = (id: string, fnName: string): TestCase => ({
  id,
  name: `Edge: ${fnName}`,
  category: "Edge Functions",
  priority: "high",
  description: `Verify ${fnName} edge function is reachable`,
  status: "idle",
  run: async () => {
    try {
      const { error } = await supabase.functions.invoke(fnName, {
        method: "POST",
        body: JSON.stringify({ test: true }),
      });
      // We accept any non-network error as "reachable"
      // Edge functions may return 400/401 but that means they're deployed
      if (error && error.message?.includes("Failed to fetch")) {
        return { passed: false, error: "Function unreachable" };
      }
      return { passed: true, details: error ? `Reachable (returned error: ${error.message})` : "Reachable (200 OK)" };
    } catch (e: any) {
      return { passed: false, error: e.message || "Unknown error" };
    }
  },
});

export const edgeFunctionTests: TestCase[] = [
  edgeFnTest("EF-001", "admin-create-user"),
  edgeFnTest("EF-002", "admin-reset-password"),
  edgeFnTest("EF-003", "analyze-floor-plan"),
  edgeFnTest("EF-004", "fetch-social-stats"),
  edgeFnTest("EF-005", "po-email-approval"),
  edgeFnTest("EF-006", "public-supplier-registration"),
  edgeFnTest("EF-007", "scheduled-telegram-reports"),
  edgeFnTest("EF-008", "send-approval-notification"),
  edgeFnTest("EF-009", "send-telegram-report"),
  edgeFnTest("EF-010", "test-telegram-connection"),
];
