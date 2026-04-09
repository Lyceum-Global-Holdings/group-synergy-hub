import { supabase } from "@/integrations/supabase/client";
import { TestCase } from "./types";

const tableReadTest = (id: string, name: string, table: string, priority: "critical" | "high" | "medium" = "high"): TestCase => ({
  id, name, category: "Construction", priority, description: `Verify ${table} table is accessible`, status: "idle",
  run: async () => {
    const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    if (error) return { passed: false, error: error.message };
    return { passed: true, details: "Table accessible" };
  },
});

export const constructionTests: TestCase[] = [
  tableReadTest("CN-001", "Projects Access", "construction_projects", "critical"),
  tableReadTest("CN-002", "Sites Access", "construction_sites", "critical"),
  tableReadTest("CN-003", "Floor Plans Access", "construction_floor_plans"),
  tableReadTest("CN-004", "Rooms Access", "construction_rooms"),
  tableReadTest("CN-005", "Work Orders Access", "construction_work_orders"),
  tableReadTest("CN-006", "Daily Site Reports Access", "daily_site_reports"),
  tableReadTest("CN-007", "Safety Incidents Access", "safety_incidents"),
  tableReadTest("CN-008", "Safety Inspections Access", "safety_inspections"),
  tableReadTest("CN-009", "Quality Inspections Access", "quality_inspections"),
  tableReadTest("CN-010", "Labour Directory Access", "construction_labour"),
  tableReadTest("CN-011", "Labour Attendance Access", "construction_labour_attendance"),
  tableReadTest("CN-012", "Subcontractors Access", "construction_subcontractors"),
  tableReadTest("CN-013", "Resource Allocations Access", "construction_resource_allocations"),
  tableReadTest("CN-014", "Project Budgets Access", "construction_project_budgets"),
  {
    id: "CN-015", name: "Project Count", category: "Construction", priority: "medium",
    description: "Count construction projects", status: "idle",
    run: async () => {
      const { count, error } = await supabase.from("construction_projects" as any).select("id", { count: "exact", head: true });
      if (error) return { passed: false, error: error.message };
      return { passed: true, details: `Projects: ${count ?? 0}` };
    },
  },
];
