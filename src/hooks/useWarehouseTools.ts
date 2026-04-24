// Warehouse Tools Hook - Handles CRUD operations for tool inventory
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WarehouseTool, CreateWarehouseToolData } from "@/types/toolManagement";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useRealtimeChannel } from "@/hooks/useRealtimeBus";
import { scheduleInvalidate } from "@/lib/queryInvalidation";

export function useWarehouseTools() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();

  const toolsQuery = useQuery({
    queryKey: ["warehouse-tools", selectedCompany?.id, globalLocationId],
    queryFn: async () => {
      // Phase 4: single materialized RPC replaces the embed-join.
      // Server-side LEFT JOIN + composite (company_id, created_at DESC) index.
      const { data, error } = await supabase.rpc("get_warehouse_tools_list", {
        p_company_id: selectedCompany?.id ?? null,
        p_location_id: globalLocationId ?? null,
        p_limit: 5000,
      });
      if (error) throw error;

      // Map flat rows back to the embedded shape consumers expect (WarehouseTool).
      return (data ?? []).map((row: any) => ({
        ...row,
        category: row.category_id
          ? { id: row.category_id, name: row.category_name }
          : null,
        location: row.location_id
          ? { id: row.location_id, name: row.location_name }
          : null,
        unit: row.unit_id
          ? {
              id: row.unit_id,
              name: row.unit_name,
              abbreviation: row.unit_abbreviation,
            }
          : null,
      })) as WarehouseTool[];
    },
  });

  // Realtime via shared bus — invalidate on tool_bin_allocations changes,
  // scoped to the changed company_id when the payload carries one.
  const onBinAllocChange = useCallback(
    (payload: any) => {
      const cid = (payload?.new ?? payload?.old)?.company_id;
      // Invalidate the broad key (covers all variants); debounced bursts.
      scheduleInvalidate(queryClient, ["warehouse-tools"]);
      if (cid) scheduleInvalidate(queryClient, ["warehouse-tools", cid]);
    },
    [queryClient],
  );
  useRealtimeChannel("tool_bin_allocations", onBinAllocChange);

  // Realtime via shared bus — invalidate on warehouse_tools INSERT/UPDATE/DELETE.
  const onToolsChange = useCallback(
    (payload: any) => {
      const cid = (payload?.new ?? payload?.old)?.company_id;
      scheduleInvalidate(queryClient, ["warehouse-tools"]);
      if (cid) scheduleInvalidate(queryClient, ["warehouse-tools", cid]);
    },
    [queryClient],
  );
  useRealtimeChannel("warehouse_tools", onToolsChange);

  const createToolMutation = useMutation({
    mutationFn: async (toolData: CreateWarehouseToolData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Generate tool code if not provided
      const toolCode = toolData.tool_code || `TL-${Date.now().toString(36).toUpperCase()}`;

      const { data, error } = await supabase
        .from("warehouse_tools")
        .insert({
          ...toolData,
          tool_code: toolCode,
          available_quantity: toolData.total_quantity,
          issued_quantity: 0,
          company_id: selectedCompany?.id || toolData.company_id,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Success", description: "Tool created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tool",
        variant: "destructive",
      });
    },
  });

  const createBulkToolsMutation = useMutation({
    mutationFn: async (toolsData: CreateWarehouseToolData[]) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const toolsWithDefaults = toolsData.map((tool, index) => ({
        ...tool,
        tool_code: tool.tool_code || `TL-${Date.now().toString(36).toUpperCase()}-${index}`,
        available_quantity: tool.total_quantity,
        issued_quantity: 0,
        category_id: tool.category_id || null,
        location_id: tool.location_id || null,
        // Per-row company_id wins (supports cross-company "Import from Item Master").
        // Falls back to the header-selected company for single-company workflows.
        company_id: tool.company_id ?? selectedCompany?.id,
        created_by: userData.user.id,
      }));

      const { data, error } = await supabase
        .from("warehouse_tools")
        .insert(toolsWithDefaults)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({
        title: "Success",
        description: `Successfully imported ${data.length} tools`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import tools",
        variant: "destructive",
      });
    },
  });

  const updateToolMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WarehouseTool> & { id: string }) => {
      const { data, error } = await supabase
        .from("warehouse_tools")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Success", description: "Tool updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tool",
        variant: "destructive",
      });
    },
  });

  const deleteToolMutation = useMutation({
    mutationFn: async (id: string) => {
      // Verify rows were actually removed (RLS may silently block non-admins)
      const { data, error } = await supabase
        .from("warehouse_tools")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "Delete failed: you may not have permission to delete this tool, or it no longer exists."
        );
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Success", description: "Tool deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tool",
        variant: "destructive",
      });
    },
  });

  return {
    tools: toolsQuery.data || [],
    isLoading: toolsQuery.isLoading,
    error: toolsQuery.error,
    createTool: createToolMutation.mutate,
    createBulkTools: createBulkToolsMutation.mutate,
    updateTool: updateToolMutation.mutate,
    deleteTool: deleteToolMutation.mutate,
    isCreating: createToolMutation.isPending,
    isCreatingBulk: createBulkToolsMutation.isPending,
    isUpdating: updateToolMutation.isPending,
    isDeleting: deleteToolMutation.isPending,
  };
}
