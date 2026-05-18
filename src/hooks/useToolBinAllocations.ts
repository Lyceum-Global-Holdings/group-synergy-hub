// Tool Bin Allocations Hook — manages bin-level stock allocations for tools
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { ToolBinAllocation } from "@/types/toolManagement";

interface AllocateInput {
  tool_id: string;
  bin_id: string;
  allocated_quantity: number;
  notes?: string;
}

interface MoveInput {
  tool_id: string;
  from_bin_id: string;
  to_bin_id: string;
  quantity: number;
}

export function useToolBinAllocations(toolId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const allocationsQuery = useQuery({
    queryKey: ["tool-bin-allocations", toolId, selectedCompany?.id],
    enabled: !!toolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tool_bin_allocations")
        .select(
          `*, bin:warehouse_bins!bin_id(id, bin_code, name, location_id)`
        )
        .eq("tool_id", toolId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ToolBinAllocation[];
    },
  });

  // Realtime: invalidate on any change to this tool's allocations
  useEffect(() => {
    if (!toolId) return;

    const channel = supabase
      .channel(`tool-bin-allocations-${toolId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tool_bin_allocations",
          filter: `tool_id=eq.${toolId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations", toolId] });
          queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toolId, queryClient]);

  const allocateMutation = useMutation({
    mutationFn: async (input: AllocateInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Upsert: increment if exists
      const { data: existing } = await supabase
        .from("tool_bin_allocations")
        .select("id, allocated_quantity")
        .eq("tool_id", input.tool_id)
        .eq("bin_id", input.bin_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("tool_bin_allocations")
          .update({
            allocated_quantity: Number(existing.allocated_quantity) + input.allocated_quantity,
            notes: input.notes ?? null,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("tool_bin_allocations")
        .insert({
          tool_id: input.tool_id,
          bin_id: input.bin_id,
          allocated_quantity: input.allocated_quantity,
          notes: input.notes ?? null,
          company_id: selectedCompany?.id ?? null,
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations-all"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Allocated", description: "Bin allocation saved." });
    },
    onError: (err: any) => {
      toast({
        title: "Allocation failed",
        description: err.message || "Could not allocate to bin.",
        variant: "destructive",
      });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (input: MoveInput) => {
      // 1. Lock source allocation
      const { data: source, error: srcErr } = await supabase
        .from("tool_bin_allocations")
        .select("id, allocated_quantity, available_quantity, company_id")
        .eq("tool_id", input.tool_id)
        .eq("bin_id", input.from_bin_id)
        .single();
      if (srcErr) throw srcErr;
      if (!source) throw new Error("Source bin allocation not found");
      if (Number(source.available_quantity ?? 0) < input.quantity) {
        throw new Error(
          `Insufficient quantity in source bin (${source.available_quantity} available).`
        );
      }

      // 2. Decrement source
      const { error: decErr } = await supabase
        .from("tool_bin_allocations")
        .update({
          allocated_quantity: Number(source.allocated_quantity) - input.quantity,
        })
        .eq("id", source.id);
      if (decErr) throw decErr;

      // 3. Upsert destination
      const { data: dest } = await supabase
        .from("tool_bin_allocations")
        .select("id, allocated_quantity")
        .eq("tool_id", input.tool_id)
        .eq("bin_id", input.to_bin_id)
        .maybeSingle();

      if (dest) {
        const { error: incErr } = await supabase
          .from("tool_bin_allocations")
          .update({
            allocated_quantity: Number(dest.allocated_quantity) + input.quantity,
          })
          .eq("id", dest.id);
        if (incErr) throw incErr;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error: insErr } = await supabase.from("tool_bin_allocations").insert({
          tool_id: input.tool_id,
          bin_id: input.to_bin_id,
          allocated_quantity: input.quantity,
          company_id: source.company_id ?? selectedCompany?.id ?? null,
          created_by: userData.user?.id ?? null,
        });
        if (insErr) throw insErr;
      }

      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations-all"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Moved", description: "Stock moved between bins." });
    },
    onError: (err: any) => {
      toast({
        title: "Move failed",
        description: err.message || "Could not move stock.",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      const { data, error } = await supabase
        .from("tool_bin_allocations")
        .delete()
        .eq("id", allocationId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Delete failed: insufficient permissions or row not found.");
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations-all"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Removed", description: "Bin allocation removed." });
    },
    onError: (err: any) => {
      toast({
        title: "Remove failed",
        description: err.message || "Could not remove allocation.",
        variant: "destructive",
      });
    },
  });

  return {
    allocations: allocationsQuery.data || [],
    isLoading: allocationsQuery.isLoading,
    allocate: allocateMutation.mutate,
    move: moveMutation.mutate,
    remove: removeMutation.mutate,
    isAllocating: allocateMutation.isPending,
    isMoving: moveMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}

// Lightweight hook to fetch allocations for a single tool without realtime (for dialogs)
export function useToolAllocationsForTool(toolId: string | null | undefined) {
  return useQuery({
    queryKey: ["tool-bin-allocations-picker", toolId],
    enabled: !!toolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tool_bin_allocations")
        .select(`*, bin:warehouse_bins!bin_id(id, bin_code, name, location_id)`)
        .eq("tool_id", toolId!)
        .gt("allocated_quantity", 0)
        .order("allocated_quantity", { ascending: false });
      if (error) throw error;
      return (data || []) as ToolBinAllocation[];
    },
  });
}
