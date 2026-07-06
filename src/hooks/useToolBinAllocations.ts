// Tool Bin Allocations Hook — Phase 2a
// All writes go through the standard `warehouse_bin_allocations` table via
// `useWarehouseBinAllocations`. The legacy `tool_bin_allocations` table is
// kept in sync by the existing DB triggers, so this hook only READS from it
// for the per-tool detail panel until Phase 2b drops the legacy table.
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
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

/** Resolve the warehouse_items.id linked to a warehouse_tools.id (Phase 2a cache). */
async function resolveWarehouseItemId(toolId: string): Promise<string> {
  const { data, error } = await (supabase as any)
    .from("warehouse_tools")
    .select("warehouse_item_id")
    .eq("id", toolId)
    .single();
  if (error) throw error;
  const id = (data as any)?.warehouse_item_id as string | null;
  if (!id) {
    throw new Error(
      "This tool is not yet linked to the standard inventory. Refresh the page and try again."
    );
  }
  return id;
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

  // Realtime — listen on the canonical warehouse_bin_allocations table.
  useEffect(() => {
    if (!toolId) return;

    const channel = supabase
      .channel(`tool-bin-allocations-${toolId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warehouse_bin_allocations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations", toolId] });
          queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations-all"] });
          queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
          queryClient.invalidateQueries({ queryKey: ["warehouse-bin-allocations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toolId, queryClient]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations"] });
    queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations-all"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse-bin-allocations"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse-items"] });
  };

  const allocateMutation = useMutation({
    mutationFn: async (input: AllocateInput) => {
      const userData = { user: getCachedUser() };
      if (!userData.user) throw new Error("Not authenticated");
      const warehouseItemId = await resolveWarehouseItemId(input.tool_id);

      // Upsert into the standard table; (warehouse_item_id, bin_id) is unique.
      const { data: existing } = await supabase
        .from("warehouse_bin_allocations")
        .select("id, allocated_quantity")
        .eq("warehouse_item_id", warehouseItemId)
        .eq("bin_id", input.bin_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("warehouse_bin_allocations")
          .update({
            allocated_quantity:
              Number(existing.allocated_quantity) + input.allocated_quantity,
            notes: input.notes ?? null,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data: bin, error: binErr } = await supabase
        .from("warehouse_bins")
        .select("location_id, company_id")
        .eq("id", input.bin_id)
        .single();
      if (binErr) throw binErr;
      if (!bin?.location_id || !bin?.company_id) {
        throw new Error("Selected bin is missing location/company assignment.");
      }
      const { data, error } = await supabase
        .from("warehouse_bin_allocations")
        .insert({
          warehouse_item_id: warehouseItemId,
          bin_id: input.bin_id,
          allocated_quantity: input.allocated_quantity,
          notes: input.notes ?? null,
          company_id: bin.company_id,
          location_id: bin.location_id,
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
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
      const userData = { user: getCachedUser() };
      const warehouseItemId = await resolveWarehouseItemId(input.tool_id);

      // 1. Lock source allocation
      const { data: source, error: srcErr } = await supabase
        .from("warehouse_bin_allocations")
        .select("id, allocated_quantity, available_quantity, company_id")
        .eq("warehouse_item_id", warehouseItemId)
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
        .from("warehouse_bin_allocations")
        .update({
          allocated_quantity:
            Number(source.allocated_quantity) - input.quantity,
        })
        .eq("id", source.id);
      if (decErr) throw decErr;

      // 3. Upsert destination
      const { data: dest } = await supabase
        .from("warehouse_bin_allocations")
        .select("id, allocated_quantity")
        .eq("warehouse_item_id", warehouseItemId)
        .eq("bin_id", input.to_bin_id)
        .maybeSingle();

      if (dest) {
        const { error: incErr } = await supabase
          .from("warehouse_bin_allocations")
          .update({
            allocated_quantity: Number(dest.allocated_quantity) + input.quantity,
          })
          .eq("id", dest.id);
        if (incErr) throw incErr;
      } else {
        const { data: destBin, error: destBinErr } = await supabase
          .from("warehouse_bins")
          .select("location_id, company_id")
          .eq("id", input.to_bin_id)
          .single();
        if (destBinErr) throw destBinErr;
        if (!destBin?.location_id || !destBin?.company_id) {
          throw new Error("Destination bin is missing location/company assignment.");
        }
        const { error: insErr } = await supabase
          .from("warehouse_bin_allocations")
          .insert({
            warehouse_item_id: warehouseItemId,
            bin_id: input.to_bin_id,
            allocated_quantity: input.quantity,
            company_id: destBin.company_id,
            location_id: destBin.location_id,
            created_by: userData.user?.id ?? null,
          });
        if (insErr) throw insErr;
      }

      return { ok: true };
    },
    onSuccess: () => {
      invalidateAll();
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
    // Accepts either the legacy tool_bin_allocations.id OR
    // a `{ tool_id, bin_id }` pair (preferred).
    mutationFn: async (
      input: string | { tool_id: string; bin_id: string }
    ) => {
      let warehouseItemId: string;
      let binId: string;

      if (typeof input === "string") {
        // Legacy id — look up the row to get tool_id+bin_id, then resolve.
        const { data: legacy, error } = await supabase
          .from("tool_bin_allocations")
          .select("tool_id, bin_id")
          .eq("id", input)
          .single();
        if (error) throw error;
        warehouseItemId = await resolveWarehouseItemId(legacy.tool_id);
        binId = legacy.bin_id;
      } else {
        warehouseItemId = await resolveWarehouseItemId(input.tool_id);
        binId = input.bin_id;
      }

      const { data, error } = await supabase
        .from("warehouse_bin_allocations")
        .delete()
        .eq("warehouse_item_id", warehouseItemId)
        .eq("bin_id", binId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Delete failed: insufficient permissions or row not found.");
      }
      return data[0];
    },
    onSuccess: () => {
      invalidateAll();
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
