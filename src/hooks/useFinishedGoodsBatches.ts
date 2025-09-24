import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FinishedGoodsBatch {
  id: string;
  batch_number: string;
  finished_good_id: string;
  quantity: number;
  production_date: string;
  expiry_date?: string;
  production_cost?: number;
  quality_check_status: string;
  quality_check_date?: string;
  quality_check_by?: string;
  notes?: string;
  status: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFinishedGoodsBatchData {
  batch_number: string;
  finished_good_id: string;
  quantity: number;
  production_date: string;
  expiry_date?: string;
  production_cost?: number;
  quality_check_status?: string;
  notes?: string;
  status?: string;
  company_id?: string;
}

export function useFinishedGoodsBatches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch finished goods batches
  const { data: batches, isLoading, error } = useQuery({
    queryKey: ['finished-goods-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finished_goods_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FinishedGoodsBatch[];
    },
  });

  // Create finished goods batch
  const createBatchMutation = useMutation({
    mutationFn: async (data: CreateFinishedGoodsBatchData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from('finished_goods_batches')
        .insert([{
          ...data,
          created_by: user.user?.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods-batches'] });
      toast({
        title: "Success",
        description: "Batch created successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error creating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create batch",
        variant: "destructive",
      });
    },
  });

  // Update finished goods batch
  const updateBatchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateFinishedGoodsBatchData> }) => {
      const { data: result, error } = await supabase
        .from('finished_goods_batches')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods-batches'] });
      toast({
        title: "Success",
        description: "Batch updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error updating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update batch",
        variant: "destructive",
      });
    },
  });

  // Delete finished goods batch
  const deleteBatchMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finished_goods_batches')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods-batches'] });
      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete batch",
        variant: "destructive",
      });
    },
  });

  return {
    batches,
    isLoading,
    error,
    createBatch: createBatchMutation.mutate,
    updateBatch: updateBatchMutation.mutate,
    deleteBatch: deleteBatchMutation.mutate,
    isCreating: createBatchMutation.isPending,
    isUpdating: updateBatchMutation.isPending,
    isDeleting: deleteBatchMutation.isPending,
  };
}