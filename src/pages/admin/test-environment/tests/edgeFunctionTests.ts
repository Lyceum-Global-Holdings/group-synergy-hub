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
        body: { test: true },
      });

      if (!error) {
        return { passed: true, details: "Reachable (200 OK)" };
      }

      const msg = error.message || "";

      // Network-level failure = truly unreachable
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        return { passed: false, error: "Function unreachable (network error)" };
      }

      // 400 (validation) / 401 (auth) / 403 (authorization) all prove the function is
      // deployed and executing — it just rejected our synthetic { test: true } payload.
      // That is the expected outcome of a reachability probe.
      const status = (error as any).context?.status ?? (error as any).status;
      if (status === 400 || status === 401 || status === 403) {
        return { passed: true, details: `Reachable (deployed, rejected probe with ${status})` };
      }

      // 5xx or unknown = real problem
      return { passed: false, error: `Unexpected response: ${msg}` };
    } catch (e: any) {
      const msg = e?.message || "Unknown error";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        return { passed: false, error: "Function unreachable (network error)" };
      }
      return { passed: false, error: msg };
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
