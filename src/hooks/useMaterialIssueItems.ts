import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreateMaterialIssueItemData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';

export const useMaterialIssueItems = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createItemsMutation = useMutation({
    mutationFn: async (items: CreateMaterialIssueItemData[]) => {
      // Insert items only. Stock deduction happens server-side inside
      // approve_material_issue() once an admin approves the MIN
      // (ISO 9001 §8.5.1 / SAP MIGO segregation of duties).
      const { data: createdItems, error } = await supabase
        .from('material_issue_items')
        .insert(items)
        .select();

      if (error) throw error;
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
