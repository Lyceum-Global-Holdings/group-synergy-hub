import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiDefinition } from "@/types/kpi";
import { toast } from "sonner";

export function useKpiMutations() {
  const queryClient = useQueryClient();

  const createKpi = useMutation({
    mutationFn: async (kpi: Partial<KpiDefinition>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("kpi_definitions")
        .insert({
          name: kpi.name!,
          description: kpi.description,
          category: kpi.category,
          data_source: kpi.data_source,
          calculation_type: kpi.calculation_type,
          sql_query: kpi.sql_query,
          target_value: kpi.target_value,
          unit: kpi.unit,
          refresh_interval: kpi.refresh_interval,
          is_system: kpi.is_system,
          company_id: kpi.company_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      toast.success("KPI created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create KPI: ${error.message}`);
    },
  });

  const updateKpi = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KpiDefinition> & { id: string }) => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      toast.success("KPI updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update KPI: ${error.message}`);
    },
  });

  const deleteKpi = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kpi_definitions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      toast.success("KPI deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete KPI: ${error.message}`);
    },
  });

  return {
    createKpi,
    updateKpi,
    deleteKpi,
  };
}
