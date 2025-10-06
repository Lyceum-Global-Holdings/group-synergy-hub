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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
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
