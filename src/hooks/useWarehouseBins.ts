import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseBin, CreateWarehouseBinData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';

export const useWarehouseBins = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: bins = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['warehouse-bins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .order('bin_code');

      if (error) throw error;
      return data as WarehouseBin[];
    }
  });

  const createBinMutation = useMutation({
    mutationFn: async (binData: CreateWarehouseBinData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('warehouse_bins')
        .insert({
          ...binData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins'] });
      toast({
        title: "Success",
        description: "Bin created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating bin:', error);
      toast({
        title: "Error",
        description: "Failed to create bin",
        variant: "destructive",
      });
    }
  });

  const updateBinMutation = useMutation({
    mutationFn: async ({ id, ...binData }: Partial<WarehouseBin> & { id: string }) => {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .update(binData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins'] });
      toast({
        title: "Success",
        description: "Bin updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating bin:', error);
      toast({
        title: "Error",
        description: "Failed to update bin",
        variant: "destructive",
      });
    }
  });

  const deleteBinMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouse_bins')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins'] });
      toast({
        title: "Success",
        description: "Bin deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting bin:', error);
      toast({
        title: "Error",
        description: "Failed to delete bin",
        variant: "destructive",
      });
    }
  });

  return {
    bins,
    isLoading,
    error,
    createBin: createBinMutation.mutate,
    updateBin: updateBinMutation.mutate,
    deleteBin: deleteBinMutation.mutate,
    isCreating: createBinMutation.isPending,
    isUpdating: updateBinMutation.isPending,
    isDeleting: deleteBinMutation.isPending,
  };
};