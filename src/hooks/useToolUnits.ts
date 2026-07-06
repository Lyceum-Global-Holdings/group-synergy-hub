import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { toast } from "@/hooks/use-toast";
import type { ToolUnit, ToolUnitEvent, CreateToolUnitInput, ToolUnitStatus, ToolUnitCondition } from "@/types/toolUnits";

const db = supabase as any;

export function useToolUnits(toolId?: string) {
  const queryClient = useQueryClient();

  const { data: units = [], isLoading, error } = useQuery({
    queryKey: ["tool-units", toolId],
    enabled: !!toolId,
    queryFn: async () => {
      const { data, error } = await db
        .from("tool_units")
        .select("*")
        .eq("tool_id", toolId)
        .order("unit_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ToolUnit[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tool-units"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
  };

  const createUnit = useMutation({
    mutationFn: async (input: CreateToolUnitInput) => {
      const user = getCachedUser();
      const { data, error } = await db
        .from("tool_units")
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as ToolUnit;
    },
    onSuccess: () => { invalidate(); toast({ title: "Unit added" }); },
    onError: (e: any) => toast({ title: "Failed to add unit", description: e.message, variant: "destructive" }),
  });

  /** Register N units at once (unit codes auto-assigned by the DB trigger). */
  const generateUnits = useMutation({
    mutationFn: async ({ count, base }: { count: number; base: CreateToolUnitInput }) => {
      const user = getCachedUser();
      const rows = Array.from({ length: Math.max(1, count) }, () => ({ ...base, created_by: user?.id }));
      const { data, error } = await db.from("tool_units").insert(rows).select();
      if (error) throw error;
      return (data ?? []) as ToolUnit[];
    },
    onSuccess: (rows) => { invalidate(); toast({ title: `${rows.length} unit(s) registered` }); },
    onError: (e: any) => toast({ title: "Failed to register units", description: e.message, variant: "destructive" }),
  });

  const updateUnit = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ToolUnit> }) => {
      const { error } = await db.from("tool_units").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Unit updated" }); },
    onError: (e: any) => toast({ title: "Failed to update unit", description: e.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, condition }: { id: string; status?: ToolUnitStatus; condition?: ToolUnitCondition }) => {
      const patch: Record<string, unknown> = {};
      if (status) patch.status = status;
      if (condition) patch.condition = condition;
      const { error } = await db.from("tool_units").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Failed to update unit", description: e.message, variant: "destructive" }),
  });

  return { units, isLoading, error, createUnit, generateUnits, updateUnit, setStatus };
}

/** Append-only lifecycle timeline for one unit. */
export function useToolUnitEvents(unitId?: string) {
  return useQuery({
    queryKey: ["tool-unit-events", unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await db
        .from("tool_unit_events")
        .select("*")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ToolUnitEvent[];
    },
  });
}
