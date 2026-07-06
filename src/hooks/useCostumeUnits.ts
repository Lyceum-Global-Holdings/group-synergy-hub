import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { CostumeUnit, CreateCostumeUnitData } from "@/types/costumeRental";
import { toast } from "sonner";

export function useCostumeUnits(costumeId?: string) {
  const queryClient = useQueryClient();

  const { data: units = [], isLoading, error } = useQuery({
    queryKey: ["costume-units", costumeId],
    enabled: !!costumeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rental_costume_units")
        .select("*")
        .eq("costume_id", costumeId)
        .order("unit_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CostumeUnit[];
    },
  });

  const createUnit = useMutation({
    mutationFn: async (input: CreateCostumeUnitData) => {
      const user = getCachedUser();
      const { data, error } = await (supabase as any)
        .from("rental_costume_units")
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as CostumeUnit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costume-units"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Unit added");
    },
    onError: (e: any) => toast.error(`Failed to add unit: ${e.message}`),
  });

  const updateUnit = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CreateCostumeUnitData>) => {
      const { data, error } = await (supabase as any)
        .from("rental_costume_units")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CostumeUnit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costume-units"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Unit updated");
    },
    onError: (e: any) => toast.error(`Failed to update unit: ${e.message}`),
  });

  const deleteUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("rental_costume_units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costume-units"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Unit removed");
    },
    onError: (e: any) => toast.error(`Failed to remove unit: ${e.message}`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["costume-units"] });
    queryClient.invalidateQueries({ queryKey: ["costumes"] });
    queryClient.invalidateQueries({ queryKey: ["costume-unit-events"] });
    queryClient.invalidateQueries({ queryKey: ["costume-unit-maintenance"] });
    queryClient.invalidateQueries({ queryKey: ["costume-stock"] });
  };

  // Validated status transition (server enforces the state machine).
  const changeStatus = useMutation({
    mutationFn: async (
      { unitId, status, condition, reason }:
      { unitId: string; status: string; condition?: string | null; reason?: string | null },
    ) => {
      const { error } = await (supabase as any).rpc("change_costume_unit_status", {
        p_unit_id: unitId, p_new_status: status,
        p_condition: condition ?? null, p_reason: reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Unit status updated"); },
    onError: (e: any) => toast.error(e.message ?? "Failed to update status"),
  });

  // Disposal / decommission (terminal).
  const disposeUnit = useMutation({
    mutationFn: async (
      { unitId, reason, method, value }:
      { unitId: string; reason: string; method?: string | null; value?: number | null },
    ) => {
      const { error } = await (supabase as any).rpc("dispose_costume_unit", {
        p_unit_id: unitId, p_reason: reason,
        p_method: method ?? null, p_value: value ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Unit disposed"); },
    onError: (e: any) => toast.error(e.message ?? "Failed to dispose unit"),
  });

  // Maintenance / service record (optionally moves the unit in/out of service).
  const recordMaintenance = useMutation({
    mutationFn: async (
      { unitId, type, date, performedBy, provider, cost, description, newStatus, condition }:
      {
        unitId: string; type: string; date?: string; performedBy?: string | null;
        provider?: string | null; cost?: number; description?: string | null;
        newStatus?: string | null; condition?: string | null;
      },
    ) => {
      const { error } = await (supabase as any).rpc("record_costume_unit_maintenance", {
        p_unit_id: unitId, p_type: type, p_date: date ?? null,
        p_performed_by: performedBy ?? null, p_provider: provider ?? null,
        p_cost: cost ?? 0, p_description: description ?? null,
        p_new_status: newStatus ?? null, p_condition: condition ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Maintenance recorded"); },
    onError: (e: any) => toast.error(e.message ?? "Failed to record maintenance"),
  });

  return {
    units, isLoading, error,
    createUnit, updateUnit, deleteUnit,
    changeStatus, disposeUnit, recordMaintenance,
  };
}
