import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseItem, CreateWarehouseItemData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';

export const useWarehouseItems = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: items = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['warehouse-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WarehouseItem[];
    }
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: CreateWarehouseItemData & { initialStock?: number; initialUnitCost?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { initialStock, initialUnitCost, ...itemDataWithoutStock } = itemData;

      const { data, error } = await supabase
        .from('warehouse_items')
        .insert({
          ...itemDataWithoutStock,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return { item: data, initialStock, initialUnitCost };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success", 
        description: "Item created successfully",
      });
      
      // Create initial stock transaction if provided
      if (result.initialStock && result.initialStock > 0) {
        // We'll handle this in the component using the returned data
      }
    },
    onError: (error: any) => {
      console.error('Error creating item:', error);
      
      let errorMessage = "Failed to create item";
      
      // Handle specific constraint violations
      if (error?.message?.includes('warehouse_items_sku_company_id_key')) {
        errorMessage = "An item with this SKU already exists for the selected company";
      } else if (error?.message?.includes('warehouse_items_barcode_key')) {
        errorMessage = "An item with this barcode already exists";
      } else if (error?.message?.includes('warehouse_items_item_code_key')) {
        errorMessage = "An item with this code already exists";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...itemData }: Partial<WarehouseItem> & { id: string }) => {
      console.log('Updating item with ID:', id);
      console.log('Update payload:', itemData);
      
      const { data, error } = await supabase
        .from('warehouse_items')
        .update(itemData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      console.log('Update successful, returned data:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error updating item:', error);
      
      let errorMessage = "Failed to update item";
      
      // Handle specific constraint violations
      if (error?.message?.includes('warehouse_items_sku_company_id_key')) {
        errorMessage = "An item with this SKU already exists for the selected company";
      } else if (error?.message?.includes('warehouse_items_barcode_key')) {
        errorMessage = "An item with this barcode already exists";
      } else if (error?.message?.includes('warehouse_items_item_code_key')) {
        errorMessage = "An item with this code already exists";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ id, forceDelete }: { id: string; forceDelete: boolean }) => {
      if (forceDelete) {
        // Force delete - this will cascade delete references
        const { error } = await supabase
          .from('warehouse_items')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } else {
        // Safe delete - check for references first
        const { error } = await supabase
          .from('warehouse_items')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting item:', error);
      
      let errorMessage = "Failed to delete item";
      
      // Handle foreign key constraint errors
      if (error?.message?.includes('foreign key constraint') || 
          error?.message?.includes('violates foreign key') ||
          error?.code === '23503') {
        errorMessage = "Cannot delete item as it is referenced in other records. Please mark it as inactive instead.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const markItemInactiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: "Item marked as inactive successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error marking item inactive:', error);
      toast({
        title: "Error",
        description: "Failed to mark item as inactive",
        variant: "destructive",
      });
    }
  });

  return {
    items,
    isLoading,
    error,
    createItem: createItemMutation.mutate,
    createItemAsync: createItemMutation.mutateAsync,
    updateItem: updateItemMutation.mutate,
    deleteItem: ({ id, forceDelete = false }: { id: string; forceDelete?: boolean }) => 
      deleteItemMutation.mutate({ id, forceDelete }),
    markItemInactive: markItemInactiveMutation.mutate,
    isCreating: createItemMutation.isPending,
    isUpdating: updateItemMutation.isPending,
    isDeleting: deleteItemMutation.isPending,
    isMarkingInactive: markItemInactiveMutation.isPending,
  };
};