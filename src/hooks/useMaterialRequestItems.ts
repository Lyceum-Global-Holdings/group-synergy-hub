import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialRequestItem, CreateMaterialRequestItemData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';

export const useMaterialRequestItems = (requestId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch items for a specific request
  const { data: requestItems, isLoading } = useQuery({
    queryKey: ['material-request-items', requestId],
    queryFn: async () => {
      if (!requestId) return [];
      
      const { data, error } = await supabase
        .from('material_request_items')
        .select('*')
        .eq('request_id', requestId)
        .order('line_number', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as MaterialRequestItem[];
    },
    enabled: !!requestId,
  });

  // Create items (bulk)
  const createItemsMutation = useMutation({
    mutationFn: async (items: CreateMaterialRequestItemData[]) => {
      const { data, error } = await supabase
        .from('material_request_items')
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request-items'] });
    },
    onError: (error) => {
      console.error('Error creating request items:', error);
      toast({
        title: "Error",
        description: "Failed to create request items",
        variant: "destructive",
      });
    }
  });

  // Update item
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<MaterialRequestItem> & { id: string }) => {
      const { error } = await supabase
        .from('material_request_items')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request-items'] });
      toast({
        title: "Success",
        description: "Request item updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating item:', error);
      toast({
        title: "Error",
        description: "Failed to update request item",
        variant: "destructive",
      });
    }
  });

  // Delete item
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_request_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-request-items'] });
      toast({
        title: "Success",
        description: "Request item deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete request item",
        variant: "destructive",
      });
    }
  });

  return {
    requestItems,
    isLoading,
    createItems: createItemsMutation.mutateAsync,
    isCreating: createItemsMutation.isPending,
    updateItem: updateItemMutation.mutate,
    isUpdating: updateItemMutation.isPending,
    deleteItem: deleteItemMutation.mutate,
    isDeleting: deleteItemMutation.isPending,
  };
};
