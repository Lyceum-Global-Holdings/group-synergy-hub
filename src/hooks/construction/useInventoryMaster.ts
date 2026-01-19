import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { InventoryMaster, CreateInventoryMasterData, UpdateInventoryMasterData } from "@/types/construction";

export function useInventoryMaster() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["inventory-master", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("construction_inventory_master")
        .select(`
          *,
          warehouse_location:warehouse_locations(id, name)
        `)
        .order("created_at", { ascending: false });

      // If a specific company is selected, filter by it
      // Otherwise (All Companies), show all items
      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InventoryMaster[];
    },
    // Enable the query even when no company is selected (All Companies mode)
    enabled: true,
  });
}

export function useCreateInventoryMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateInventoryMasterData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("construction_inventory_master")
        .insert({
          ...data,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      toast({ title: "Inventory item created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating inventory item", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateInventoryMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInventoryMasterData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("construction_inventory_master")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      toast({ title: "Inventory item updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating inventory item", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteInventoryMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("construction_inventory_master")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      toast({ title: "Inventory item deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting inventory item", description: error.message, variant: "destructive" });
    },
  });
}
