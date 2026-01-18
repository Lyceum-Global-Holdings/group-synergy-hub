import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ItemBatch, BatchAllocation, CreateBatchData } from '@/types/batch';

export const useBatches = (warehouseItemId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: batches = [], isLoading, error } = useQuery({
    queryKey: ['item-batches', warehouseItemId],
    queryFn: async () => {
      let query = supabase
        .from('item_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (warehouseItemId) {
        query = query.eq('warehouse_item_id', warehouseItemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ItemBatch[];
    },
    enabled: true,
  });

  return { batches, isLoading, error };
};

export const useAvailableBatches = (warehouseItemId: string, enabled = true) => {
  return useQuery({
    queryKey: ['available-batches', warehouseItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_batches')
        .select('*')
        .eq('warehouse_item_id', warehouseItemId)
        .eq('status', 'active')
        .gt('quantity_remaining', 0)
        .order('manufacturing_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ItemBatch[];
    },
    enabled: enabled && !!warehouseItemId,
  });
};

export const useCreateBatch = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchData: CreateBatchData) => {
      const { data, error } = await supabase
        .from('item_batches')
        .insert(batchData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      toast({
        title: 'Success',
        description: 'Batch created successfully',
      });
    },
    onError: (error) => {
      console.error('Error creating batch:', error);
      toast({
        title: 'Error',
        description: 'Failed to create batch',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateBatchQuantity = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId, quantityChange }: { batchId: string; quantityChange: number }) => {
      // First get current quantity
      const { data: batch, error: fetchError } = await supabase
        .from('item_batches')
        .select('quantity_remaining')
        .eq('id', batchId)
        .single();

      if (fetchError) throw fetchError;

      const newQuantity = Math.max(0, batch.quantity_remaining + quantityChange);

      const { data, error } = await supabase
        .from('item_batches')
        .update({ quantity_remaining: newQuantity })
        .eq('id', batchId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
    },
    onError: (error) => {
      console.error('Error updating batch quantity:', error);
      toast({
        title: 'Error',
        description: 'Failed to update batch quantity',
        variant: 'destructive',
      });
    },
  });
};

export const useCreateBatchIssueDetails = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (details: { issue_item_id: string; batch_id: string; quantity_from_batch: number }[]) => {
      const { data, error } = await supabase
        .from('batch_issue_details')
        .insert(details)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['batch-issue-details'] });
    },
  });
};

// FIFO Allocation Function
export function allocateFIFO(batches: ItemBatch[], quantityNeeded: number): { allocations: BatchAllocation[]; unfulfilled: number } {
  const allocations: BatchAllocation[] = [];
  let remaining = quantityNeeded;

  // Sort by manufacturing_date first (oldest first), then by created_at
  const sortedBatches = [...batches].sort((a, b) => {
    const dateA = a.manufacturing_date || a.created_at;
    const dateB = b.manufacturing_date || b.created_at;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  for (const batch of sortedBatches) {
    if (remaining <= 0) break;

    const allocateQty = Math.min(batch.quantity_remaining, remaining);
    if (allocateQty > 0) {
      allocations.push({
        batch_id: batch.id,
        batch_number: batch.batch_number,
        quantity: allocateQty,
        expiry_date: batch.expiry_date,
        manufacturing_date: batch.manufacturing_date,
      });
      remaining -= allocateQty;
    }
  }

  return { allocations, unfulfilled: Math.max(0, remaining) };
}

// Check if item is batch tracked
export const useIsItemBatchTracked = (warehouseItemId: string) => {
  return useQuery({
    queryKey: ['is-batch-tracked', warehouseItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .select('is_batch_tracked')
        .eq('id', warehouseItemId)
        .single();

      if (error) throw error;
      return data?.is_batch_tracked ?? false;
    },
    enabled: !!warehouseItemId,
  });
};
