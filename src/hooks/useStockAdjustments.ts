import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from '@/hooks/use-toast';

export interface AdjustmentBatch {
  id: string;
  batch_number: string;
  adjustment_date: string;
  adjustment_type: string;
  reason_category: string;
  total_items: number;
  total_value_impact: number;
  status: string;
  requires_approval: boolean;
  approval_threshold_exceeded: boolean;
  submitted_by: string | null;
  submitted_date: string | null;
  approved_by: string | null;
  approved_date: string | null;
  rejection_reason: string | null;
  company_id: string | null;
  location_id: string | null;
  notes: string | null;
  attachments: any[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBatchData {
  adjustment_date: string;
  adjustment_type: string;
  reason_category: string;
  notes?: string;
  location_id?: string;
}

export interface AdjustmentFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  adjustmentType?: string;
  itemId?: string;
}

export const useStockAdjustments = (filters?: AdjustmentFilters) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all adjustments (stock transactions of type adjustment)
  const {
    data: adjustments = [],
    isLoading: isLoadingAdjustments,
  } = useQuery({
    queryKey: ['stock-adjustments', filters],
    queryFn: async () => {
      let query = supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_type', 'adjustment')
        .order('created_at', { ascending: false });

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      if (filters?.itemId) {
        query = query.eq('item_id', filters.itemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch batches
  const {
    data: batches = [],
    isLoading: isLoadingBatches,
  } = useQuery({
    queryKey: ['adjustment-batches', filters?.status],
    queryFn: async () => {
      let query = supabase
        .from('stock_adjustment_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdjustmentBatch[];
    },
  });

  // Create batch
  const createBatchMutation = useMutation({
    mutationFn: async (batchData: CreateBatchData) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('stock_adjustment_batches')
        .insert({
          ...batchData,
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustment-batches'] });
      toast({
        title: 'Success',
        description: 'Adjustment batch created successfully',
      });
    },
    onError: (error) => {
      console.error('Error creating batch:', error);
      toast({
        title: 'Error',
        description: 'Failed to create adjustment batch',
        variant: 'destructive',
      });
    },
  });

  // Update batch
  const updateBatchMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdjustmentBatch> }) => {
      const { data, error } = await supabase
        .from('stock_adjustment_batches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustment-batches'] });
      toast({
        title: 'Success',
        description: 'Batch updated successfully',
      });
    },
    onError: (error) => {
      console.error('Error updating batch:', error);
      toast({
        title: 'Error',
        description: 'Failed to update batch',
        variant: 'destructive',
      });
    },
  });

  // Approve batch
  const approveBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('stock_adjustment_batches')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_date: new Date().toISOString(),
        })
        .eq('id', batchId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustment-batches'] });
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
      toast({
        title: 'Success',
        description: 'Batch approved successfully',
      });
    },
    onError: (error) => {
      console.error('Error approving batch:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve batch',
        variant: 'destructive',
      });
    },
  });

  // Reject batch
  const rejectBatchMutation = useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: string; reason: string }) => {
      const { data, error } = await supabase
        .from('stock_adjustment_batches')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', batchId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustment-batches'] });
      toast({
        title: 'Success',
        description: 'Batch rejected',
      });
    },
    onError: (error) => {
      console.error('Error rejecting batch:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject batch',
        variant: 'destructive',
      });
    },
  });

  return {
    adjustments,
    batches,
    isLoading: isLoadingAdjustments || isLoadingBatches,
    createBatch: createBatchMutation.mutate,
    updateBatch: updateBatchMutation.mutate,
    approveBatch: approveBatchMutation.mutate,
    rejectBatch: rejectBatchMutation.mutate,
    isCreating: createBatchMutation.isPending,
    isUpdating: updateBatchMutation.isPending,
  };
};
