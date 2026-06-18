import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialReturnItem, CreateMaterialReturnItemData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';

export type MaterialReturnItemWithDetails = MaterialReturnItem & {
  item_code?: string | null;
  item_name?: string | null;
  unit_of_measure?: string | null;
};

export const useMaterialReturnItems = (returnId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: returnItems, isLoading } = useQuery({
    queryKey: ['material-return-items', returnId],
    queryFn: async () => {
      if (!returnId) return [];
      
      const { data, error } = await supabase.rpc('get_material_return_items' as any, {
        p_mrn_id: returnId,
      });

      if (error) throw error;
      return data as MaterialReturnItemWithDetails[];
    },
    enabled: !!returnId,
  });

  const createItemsMutation = useMutation({
    mutationFn: async (items: CreateMaterialReturnItemData[]) => {
      const { data, error } = await supabase
        .from('material_return_items')
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-return-items'] });
    },
    onError: (error) => {
      console.error('Error creating return items:', error);
      toast({
        title: "Error",
        description: "Failed to create return items",
        variant: "destructive",
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<MaterialReturnItem> & { id: string }) => {
      const { error } = await supabase
        .from('material_return_items')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-return-items'] });
      toast({
        title: "Success",
        description: "Return item updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating return item:', error);
      toast({
        title: "Error",
        description: "Failed to update return item",
        variant: "destructive",
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_return_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-return-items'] });
      toast({
        title: "Success",
        description: "Return item deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting return item:', error);
      toast({
        title: "Error",
        description: "Failed to delete return item",
        variant: "destructive",
      });
    }
  });

  return {
    returnItems,
    isLoading,
    createItems: createItemsMutation.mutateAsync,
    isCreating: createItemsMutation.isPending,
    updateItem: updateItemMutation.mutate,
    isUpdating: updateItemMutation.isPending,
    deleteItem: deleteItemMutation.mutate,
    isDeleting: deleteItemMutation.isPending,
  };
};
