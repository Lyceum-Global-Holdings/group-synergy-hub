import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const SUPABASE_URL = (supabase as any).supabaseUrl as string;

const edgeFnTest = (id: string, fnName: string): TestCase => ({
  id,
  name: `Edge: ${fnName}`,
  category: "Edge Functions",
  priority: "high",
  description: `Verify ${fnName} edge function is reachable`,
  status: "idle",
  run: async () => {
    // Probe via CORS preflight (OPTIONS). A deployed function responds with
    // 200/204 + CORS headers WITHOUT executing handler logic — so we never
    // trigger validation errors, auth checks, or SDK error logging that would
    // otherwise show up as RUNTIME_ERROR in the browser console.
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization, content-type",
          Origin: window.location.origin,
        },
      });

      if (res.ok || res.status === 204) {
        return { passed: true, details: `Reachable (CORS preflight ${res.status})` };
      }

      if (res.status === 404) {
        return { passed: false, error: "Function not deployed (404)" };
      }

      // Any other response from the edge runtime still proves it's reachable.
      return { passed: true, details: `Reachable (preflight returned ${res.status})` };
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
  edgeFnTest("EF-011", "sourcing-notify"),
];
