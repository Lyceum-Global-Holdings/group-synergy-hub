import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const db = supabase as any;

export type ToolMaintenanceType = "preventive" | "repair" | "inspection" | "overhaul";

export interface ToolMaintenance {
  id: string;
  unit_id: string;
  maintenance_type: ToolMaintenanceType;
  maintenance_date: string;
  performed_by?: string | null;
  provider?: string | null;
  cost?: number | null;
  description?: string | null;
  out_of_service: boolean;
  interval_months?: number | null;
  next_due_date?: string | null;
  created_at: string;
}

export interface RecordMaintenanceInput {
  unit_id: string;
  maintenance_type: ToolMaintenanceType;
  maintenance_date: string;
  performed_by?: string;
  provider?: string;
  cost?: number | null;
  description?: string;
  out_of_service?: boolean;
  interval_months?: number | null;
  next_due_date?: string | null;
}

export function useToolMaintenance(unitId?: string) {
  const queryClient = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["tool-maintenance", unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await db
        .from("tool_maintenance")
        .select("*")
        .eq("unit_id", unitId)
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ToolMaintenance[];
    },
  });

  const record = useMutation({
    mutationFn: async (input: RecordMaintenanceInput) => {
      const { data, error } = await db.rpc("record_tool_maintenance", {
        p_unit_id: input.unit_id,
        p_maintenance_type: input.maintenance_type,
        p_maintenance_date: input.maintenance_date,
        p_performed_by: input.performed_by ?? null,
        p_provider: input.provider ?? null,
        p_cost: input.cost ?? null,
        p_description: input.description ?? null,
        p_out_of_service: input.out_of_service ?? false,
        p_interval_months: input.interval_months ?? null,
        p_next_due_date: input.next_due_date ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["tool-units"] });
      queryClient.invalidateQueries({ queryKey: ["tool-unit-events"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Maintenance recorded" });
    },
    onError: (e: any) => toast({ title: "Failed to record maintenance", description: e.message, variant: "destructive" }),
  });

  return { records, isLoading, record };
}
