import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreateMaterialIssueItemData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';

export const useMaterialIssueItems = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createItemsMutation = useMutation({
    mutationFn: async (items: CreateMaterialIssueItemData[]) => {
      const { data: createdItems, error } = await supabase
        .from('material_issue_items')
        .insert(items)
        .select();

      if (error) throw error;

      const insertedIds = (createdItems ?? []).map((r: any) => r.id);
      const failures: string[] = [];

      for (const item of createdItems ?? []) {
        try {
          if (item.from_reservation && item.reservation_id) {
            const { error: rpcError } = await supabase.rpc('update_reservation_on_issue', {
              p_reservation_id: item.reservation_id,
              p_quantity_issued: item.quantity_issued,
            });
            if (rpcError) throw rpcError;
          }

          let binAllocationId: string | null = null;
          if (item.reservation_id) {
            const { data: reservation } = await supabase
              .from('warehouse_item_reservations')
              .select('bin_allocation_id')
              .eq('id', item.reservation_id)
              .single();
            binAllocationId = reservation?.bin_allocation_id ?? null;
          }

          const { data: minData } = await supabase
            .from('material_issue_notes')
            .select('min_number, location_id')
            .eq('id', item.min_id)
            .single();

          if (!minData?.location_id) {
            throw new Error('Material Issue Note has no location set; cannot deduct stock.');
          }

          const { error: stockError } = await supabase.rpc('process_material_issue_stock_update', {
            p_item_id: item.item_id,
            p_quantity_issued: item.quantity_issued,
            p_location_id: minData.location_id,
            p_bin_allocation_id: binAllocationId,
            p_min_id: item.min_id,
            p_min_number: minData?.min_number || null,
            p_secondary_quantity_issued: (item as any).secondary_quantity_issued ?? null,
          } as any);

          if (stockError) throw stockError;
        } catch (err: any) {
          failures.push(`${item.item_code || item.item_id}: ${err.message || err}`);
        }
      }

      if (failures.length > 0) {
        // Roll back inserted items so the MIN can be retried cleanly
        if (insertedIds.length > 0) {
          await supabase.from('material_issue_items').delete().in('id', insertedIds);
        }
        throw new Error(
          `Stock could not be deducted for ${failures.length} line(s): ${failures.join('; ')}`
        );
      }

      return createdItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock-movements'] });
    },
    onError: (error: any) => {
      console.error('Error creating material issue items:', error);
      toast({
        title: 'Material Issue Failed',
        description: error?.message || 'Failed to create material issue items',
        variant: 'destructive',
      });
    },
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
