import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ItemUnit, CreateItemUnitData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';

export const useItemUnits = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: units = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['item-units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_units')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as ItemUnit[];
    }
  });

  const createUnitMutation = useMutation({
    mutationFn: async (unitData: CreateItemUnitData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('item_units')
        .insert({
          ...unitData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-units'] });
      toast({
        title: "Success",
        description: "Unit created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating unit:', error);
      toast({
        title: "Error",
        description: "Failed to create unit",
        variant: "destructive",
      });
    }
  });

  const updateUnitMutation = useMutation({
    mutationFn: async ({ id, ...unitData }: Partial<ItemUnit> & { id: string }) => {
      const { data, error } = await supabase
        .from('item_units')
        .update(unitData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-units'] });
      toast({
        title: "Success",
        description: "Unit updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating unit:', error);
      toast({
        title: "Error",
        description: "Failed to update unit",
        variant: "destructive",
      });
    }
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('item_units')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-units'] });
      toast({
        title: "Success",
        description: "Unit deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting unit:', error);
      toast({
        title: "Error",
        description: "Failed to delete unit",
        variant: "destructive",
      });
    }
  });

  return {
    units,
    isLoading,
    error,
    createUnit: createUnitMutation.mutate,
    updateUnit: updateUnitMutation.mutate,
    deleteUnit: deleteUnitMutation.mutate,
    isCreating: createUnitMutation.isPending,
    isUpdating: updateUnitMutation.isPending,
    isDeleting: deleteUnitMutation.isPending,
  };
};