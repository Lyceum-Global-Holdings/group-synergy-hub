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
    mutationFn: async (data: CreateInventoryMasterData & { transactionType?: 'stock_addition' | 'new_item' }) => {
      const { data: user } = await supabase.auth.getUser();
      const transactionType = data.transactionType || 'new_item';
      
      // Remove transactionType from data before inserting
      const { transactionType: _, ...insertData } = data;
      
      const { data: result, error } = await supabase
        .from("construction_inventory_master")
        .insert({
          ...insertData,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log the transaction
      await supabase
        .from("construction_inventory_transactions")
        .insert({
          item_id: result.id,
          transaction_type: transactionType,
          quantity_change: data.quantity || 0,
          quantity_before: 0,
          quantity_after: data.quantity || 0,
          to_location_id: data.location_id,
          notes: data.notes || `${transactionType === 'stock_addition' ? 'Stock added' : 'New item created'}: ${data.item_name}`,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-recent-transactions"] });
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
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateInventoryMasterData & { id: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Fetch current item to get quantity_before
      const { data: currentItem } = await supabase
        .from("construction_inventory_master")
        .select("quantity, location_id")
        .eq("id", id)
        .single();

      const { data: result, error } = await supabase
        .from("construction_inventory_master")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Log adjustment transaction if quantity changed
      const oldQuantity = currentItem?.quantity || 0;
      const newQuantity = data.quantity ?? oldQuantity;
      const quantityChange = newQuantity - oldQuantity;

      if (quantityChange !== 0) {
        await supabase
          .from("construction_inventory_transactions")
          .insert({
            item_id: id,
            transaction_type: 'adjustment',
            quantity_change: quantityChange,
            quantity_before: oldQuantity,
            quantity_after: newQuantity,
            from_location_id: currentItem?.location_id,
            to_location_id: data.location_id || currentItem?.location_id,
            notes: data.notes || `Quantity adjusted from ${oldQuantity} to ${newQuantity}`,
            company_id: selectedCompany?.id,
            created_by: user.user?.id,
          });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-recent-transactions"] });
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

export function useBulkCreateInventoryMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (items: CreateInventoryMasterData[]) => {
      const { data: user } = await supabase.auth.getUser();
      
      const itemsWithCompany = items.map(item => ({
        ...item,
        company_id: selectedCompany?.id,
        created_by: user.user?.id,
        quantity: item.quantity || 1,
        status: item.status || 'active',
      }));

      const { data: results, error } = await supabase
        .from("construction_inventory_master")
        .insert(itemsWithCompany)
        .select();

      if (error) throw error;

      // Log transactions for each item
      if (results && results.length > 0) {
        const transactions = results.map(result => ({
          item_id: result.id,
          transaction_type: 'new_item',
          quantity_change: result.quantity || 1,
          quantity_before: 0,
          quantity_after: result.quantity || 1,
          notes: `Bulk import: ${result.item_name}`,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        }));

        await supabase
          .from("construction_inventory_transactions")
          .insert(transactions);
      }

      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-recent-transactions"] });
      toast({ title: `${data?.length || 0} inventory items imported successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Error importing inventory items", description: error.message, variant: "destructive" });
    },
  });
}
