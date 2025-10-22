import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiDefinition, KpiCategory } from "@/types/kpi";

export function useKpiDefinitions(category?: KpiCategory) {
  return useQuery({
    queryKey: ["kpi-definitions", category],
    queryFn: async () => {
      let query = supabase
        .from("kpi_definitions")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as KpiDefinition[];
    },
  });
}

export function useKpiDefinition(id: string | undefined) {
  return useQuery({
    queryKey: ["kpi-definition", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as KpiDefinition;
    },
    enabled: !!id,
  });
}
