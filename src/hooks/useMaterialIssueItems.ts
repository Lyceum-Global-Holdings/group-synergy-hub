import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreateMaterialIssueItemData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';

export const useMaterialIssueItems = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createItemsMutation = useMutation({
    mutationFn: async (items: CreateMaterialIssueItemData[]) => {
      const { data, error } = await supabase
        .from('material_issue_items')
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: async (createdItems) => {
      // Update reservations and stock for each item
      for (const item of createdItems) {
        // 1. Update reservation status if item came from reservation
        if (item.from_reservation && item.reservation_id) {
          try {
            const { error: rpcError } = await supabase.rpc('update_reservation_on_issue', {
              p_reservation_id: item.reservation_id,
              p_quantity_issued: item.quantity_issued
            });
            
            if (rpcError) {
              console.error('Error updating reservation:', rpcError);
            }
          } catch (err) {
            console.error('Error calling update_reservation_on_issue:', err);
          }
        }

        // 2. Update warehouse stock and bin allocations
        try {
          // Get bin_allocation_id from reservation if it exists
          let binAllocationId = null;
          if (item.reservation_id) {
            const { data: reservation } = await supabase
              .from('warehouse_item_reservations')
              .select('bin_allocation_id')
              .eq('id', item.reservation_id)
              .single();
            
            binAllocationId = reservation?.bin_allocation_id;
          }

          // Get MIN number for reference
          const { data: minData } = await supabase
            .from('material_issue_notes')
            .select('min_number')
            .eq('id', item.min_id)
            .single();

          const { error: stockError } = await supabase.rpc('process_material_issue_stock_update', {
            p_item_id: item.item_id,
            p_quantity_issued: item.quantity_issued,
            p_bin_allocation_id: binAllocationId,
            p_min_id: item.min_id,
            p_min_number: minData?.min_number || null
          });
          
          if (stockError) {
            console.error('Error updating stock:', stockError);
            toast({
              title: "Stock Update Warning",
              description: `Item issued but stock update had warnings: ${stockError.message}`,
              variant: "destructive",
            });
          }
        } catch (err) {
          console.error('Error calling process_material_issue_stock_update:', err);
          toast({
            title: "Stock Update Error",
            description: "Item issued but failed to update warehouse stock. Please check stock levels manually.",
            variant: "destructive",
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock-movements'] });
    },
    onError: (error) => {
      console.error('Error creating material issue items:', error);
      toast({
        title: "Error",
        description: "Failed to create material issue items",
        variant: "destructive",
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; quantity_received?: number; notes?: string }) => {
      const { error } = await supabase
        .from('material_issue_items')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating item:', error);
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    }
  });

  return {
    createItems: createItemsMutation.mutateAsync,
    updateItem: updateItemMutation.mutate,
    isCreating: createItemsMutation.isPending,
    isUpdating: updateItemMutation.isPending,
  };
};
