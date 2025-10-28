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
      // Update reservations for items that came from reservations
      for (const item of createdItems) {
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
      }
      
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
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
