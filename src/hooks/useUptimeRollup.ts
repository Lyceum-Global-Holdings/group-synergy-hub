import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UptimeRollupRow {
  target: string;
  url: string | null;
  checks: number;
  failures: number;
  uptime_pct: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  last_status: number | null;
  last_ok: boolean | null;
  last_checked_at: string | null;
}

export interface UptimeRecentCheck {
  id: string;
  target: string;
  status_code: number | null;
  latency_ms: number | null;
  ok: boolean;
  error: string | null;
  checked_at: string;
}

/** 30-day uptime rollup per target (from the uptime_rollup_30d view). */
export function useUptimeRollup() {
  return useQuery({
    queryKey: ["uptime", "rollup-30d"],
    queryFn: async () => {
      const { data, error } = await supabase
        // The view is not in generated types; cast through unknown.
        .from("uptime_rollup_30d" as never)
        .select("*")
        .order("target", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as UptimeRollupRow[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Recent raw checks for sparkline/history. Bounded to the last `hours` hours
 * and at most `limit` rows so we never pull more than a couple of MB.
 */
export function useUptimeRecent(hours = 24, limit = 2000) {
  return useQuery({
    queryKey: ["uptime", "recent", hours, limit],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("uptime_checks" as never)
        .select("id,target,status_code,latency_ms,ok,error,checked_at")
        .gte("checked_at", since)
        .order("checked_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as UptimeRecentCheck[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
