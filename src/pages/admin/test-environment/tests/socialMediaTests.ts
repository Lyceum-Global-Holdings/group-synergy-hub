import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const tableReadTest = (id: string, name: string, table: string, priority: "critical" | "high" | "medium" = "high"): TestCase => ({
  id, name, category: "Social Media", priority, description: `Verify ${table} table is accessible`, status: "idle",
  run: async () => {
    const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    if (error) return { passed: false, error: error.message };
    return { passed: true, details: "Table accessible" };
  },
});

export const socialMediaTests: TestCase[] = [
  tableReadTest("SM-001", "Social Media Accounts Access", "social_media_accounts", "critical"),
  tableReadTest("SM-002", "Social Media Access Control", "social_media_access"),
  tableReadTest("SM-003", "NDA Records Access", "social_media_nda"),
  tableReadTest("SM-004", "Activity Log Access", "social_media_activity_log"),
];
