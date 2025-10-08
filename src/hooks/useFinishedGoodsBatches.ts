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
  approval_status: string;
  approved_by?: string;
  approved_date?: string;
  approval_comments?: string;
  rejection_reason?: string;
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
          approval_status: 'pending',
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

  // Approve finished goods batch
  const approveBatchMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Update batch approval status
      const { data: batch, error: batchError } = await supabase
        .from('finished_goods_batches')
        .update({
          approval_status: 'approved',
          approved_by: user.user?.id,
          approved_date: new Date().toISOString(),
          approval_comments: comments,
        })
        .eq('id', id)
        .select()
        .single();

      if (batchError) throw batchError;

      // Record approval in audit table
      const { error: auditError } = await supabase
        .from('finished_goods_batch_approvals')
        .insert({
          batch_id: id,
          approver_id: user.user?.id,
          action: 'approved',
          comments: comments,
        });

      if (auditError) throw auditError;

      return batch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods-batches'] });
      toast({
        title: "Success",
        description: "Batch approved successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error approving batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve batch",
        variant: "destructive",
      });
    },
  });

  // Reject finished goods batch
  const rejectBatchMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Update batch approval status
      const { data: batch, error: batchError } = await supabase
        .from('finished_goods_batches')
        .update({
          approval_status: 'rejected',
          approved_by: user.user?.id,
          approved_date: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', id)
        .select()
        .single();

      if (batchError) throw batchError;

      // Record rejection in audit table
      const { error: auditError } = await supabase
        .from('finished_goods_batch_approvals')
        .insert({
          batch_id: id,
          approver_id: user.user?.id,
          action: 'rejected',
          comments: reason,
        });

      if (auditError) throw auditError;

      return batch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods-batches'] });
      toast({
        title: "Success",
        description: "Batch rejected",
      });
    },
    onError: (error: any) => {
      console.error('Error rejecting batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reject batch",
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
    approveBatch: approveBatchMutation.mutate,
    rejectBatch: rejectBatchMutation.mutate,
    isCreating: createBatchMutation.isPending,
    isUpdating: updateBatchMutation.isPending,
    isDeleting: deleteBatchMutation.isPending,
    isApproving: approveBatchMutation.isPending,
    isRejecting: rejectBatchMutation.isPending,
  };
}