import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ToolDueItem {
  tool_name: string;
  unit_code: string;
  next_due_date: string | null;
  days_to_due: number | null;
  due_state: string;
}
export interface ToolOverdueReturn {
  issue_number: string;
  tool_name: string;
  issued_to_name: string | null;
  job_reference: string | null;
  expected_return_date: string | null;
  days_overdue: number;
}
export interface ToolDueSummary {
  calibration: { count: number; items: ToolDueItem[] };
  maintenance: { count: number; items: ToolDueItem[] };
  overdue_returns: { count: number; items: ToolOverdueReturn[] };
}

const EMPTY: ToolDueSummary = {
  calibration: { count: 0, items: [] },
  maintenance: { count: 0, items: [] },
  overdue_returns: { count: 0, items: [] },
};

export function useToolDueSummary(companyId?: string | null) {
  const query = useQuery({
    queryKey: ["tool-due-summary", companyId],
    enabled: !!companyId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_tool_due_summary", { p_company_id: companyId });
      if (error) throw error;
      return (data as ToolDueSummary) ?? EMPTY;
    },
  });
  return { summary: query.data ?? EMPTY, isLoading: query.isLoading };
}
