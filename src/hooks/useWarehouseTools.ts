// Warehouse Tools Hook - Handles CRUD operations for tool inventory
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WarehouseTool, CreateWarehouseToolData } from "@/types/toolManagement";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";

export function useWarehouseTools() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const toolsQuery = useQuery({
    queryKey: ["warehouse-tools", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("warehouse_tools")
        .select(`
          *,
          category:asset_categories!category_id(id, name),
          location:warehouse_locations!location_id(id, name),
          unit:item_units!unit_id(id, name, abbreviation)
        `)
        .order("created_at", { ascending: false });

      // Filter by company if selected
      if (selectedCompany?.id) {
        query = query.or(`company_id.eq.${selectedCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WarehouseTool[];
    },
  });

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
        company_id: selectedCompany?.id || tool.company_id,
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
      const { error } = await supabase.from("warehouse_tools").delete().eq("id", id);
      if (error) throw error;
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
