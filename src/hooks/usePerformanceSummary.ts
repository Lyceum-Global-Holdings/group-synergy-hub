import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VitalRow {
  route: string;
  metric_kind: "lcp" | "inp" | "cls" | "ttfb" | "fcp";
  sample_count: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface SlowQueryRow {
  target: string;
  call_count: number;
  p50: number;
  p95: number;
  max_ms: number;
}

export interface LongTaskRow {
  route: string;
  task_count: number;
  p75_duration: number;
}

export interface PerformanceSummary {
  window_days: number;
  generated_at: string;
  vitals: VitalRow[];
  slow_queries: SlowQueryRow[];
  long_tasks: LongTaskRow[];
}

export function usePerformanceSummary(days: number) {
  return useQuery<PerformanceSummary>({
    queryKey: ["performance-summary", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_performance_summary", { p_days: days });
      if (error) throw error;
      return (data as unknown as PerformanceSummary) ?? {
        window_days: days,
        generated_at: new Date().toISOString(),
        vitals: [],
        slow_queries: [],
        long_tasks: [],
      };
    },
    staleTime: 60_000,
  });
}
