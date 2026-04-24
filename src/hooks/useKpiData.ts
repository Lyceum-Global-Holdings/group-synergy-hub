import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiValue } from "@/types/kpi";

export function useKpiData(kpiId: string | undefined, refreshInterval?: number) {
  return useQuery({
    queryKey: ["kpi-data", kpiId],
    queryFn: async () => {
      if (!kpiId) return null;

      // Get KPI definition
      const { data: kpi, error: kpiError } = await supabase
        .from("kpi_definitions")
        .select("*")
        .eq("id", kpiId)
        .single();

      if (kpiError) throw kpiError;

      // Get latest value from history
      const { data: history, error: historyError } = await supabase
        .from("kpi_history")
        .select("*")
        .eq("kpi_id", kpiId)
        .order("calculated_at", { ascending: false })
        .limit(2);

      if (historyError) throw historyError;

      const currentValue = history?.[0]?.value || 0;
      const previousValue = history?.[1]?.value;
      
      let changePercentage: number | undefined;
      let trend: 'up' | 'down' | 'stable' | undefined;

      if (previousValue !== undefined && previousValue !== 0) {
        changePercentage = ((currentValue - previousValue) / previousValue) * 100;
        trend = changePercentage > 0 ? 'up' : changePercentage < 0 ? 'down' : 'stable';
      }

      const kpiValue: KpiValue = {
        kpi,
        current_value: currentValue,
        previous_value: previousValue,
        change_percentage: changePercentage,
        trend,
        last_updated: history?.[0]?.calculated_at || new Date().toISOString(),
      };

      return kpiValue;
    },
    enabled: !!kpiId,
    refetchInterval: refreshInterval ? refreshInterval * 1000 : false,
    // Live-critical: KPI tiles always show latest computed value on mount.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useCalculateKpi(kpiId: string) {
  return useQuery({
    queryKey: ["calculate-kpi", kpiId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_kpi_value", {
        p_kpi_id: kpiId,
      });

      if (error) throw error;
      return data as number;
    },
    enabled: false, // Only run when explicitly refetched
  });
}
