import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const db = supabase as any;

export type ToolCalibrationResult = "pass" | "fail" | "adjusted" | "limited";

export interface ToolCalibration {
  id: string;
  unit_id: string;
  calibration_date: string;
  performed_by?: string | null;
  provider?: string | null;
  result: ToolCalibrationResult;
  certificate_number?: string | null;
  certificate_url?: string | null;
  interval_months?: number | null;
  next_due_date?: string | null;
  cost?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface RecordCalibrationInput {
  unit_id: string;
  calibration_date: string;
  result: ToolCalibrationResult;
  performed_by?: string;
  provider?: string;
  certificate_number?: string;
  interval_months?: number | null;
  cost?: number | null;
  next_due_date?: string | null;
  notes?: string;
}

export function useToolCalibrations(unitId?: string) {
  const queryClient = useQueryClient();

  const { data: calibrations = [], isLoading } = useQuery({
    queryKey: ["tool-calibrations", unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await db
        .from("tool_calibrations")
        .select("*")
        .eq("unit_id", unitId)
        .order("calibration_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ToolCalibration[];
    },
  });

  const record = useMutation({
    mutationFn: async (input: RecordCalibrationInput) => {
      const { data, error } = await db.rpc("record_tool_calibration", {
        p_unit_id: input.unit_id,
        p_calibration_date: input.calibration_date,
        p_result: input.result,
        p_performed_by: input.performed_by ?? null,
        p_provider: input.provider ?? null,
        p_certificate_number: input.certificate_number ?? null,
        p_certificate_url: null,
        p_interval_months: input.interval_months ?? null,
        p_cost: input.cost ?? null,
        p_next_due_date: input.next_due_date ?? null,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-calibrations"] });
      queryClient.invalidateQueries({ queryKey: ["tool-units"] });
      queryClient.invalidateQueries({ queryKey: ["tool-unit-events"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Calibration recorded" });
    },
    onError: (e: any) => toast({ title: "Failed to record calibration", description: e.message, variant: "destructive" }),
  });

  return { calibrations, isLoading, record };
}
