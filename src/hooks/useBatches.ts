import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ItemBatch, BatchAllocation, CreateBatchData, BatchFilters, BatchSummary, BatchStatus } from '@/types/batch';
import { addDays, isAfter, isBefore, parseISO } from 'date-fns';

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

// Get all batches with filters for Batch Management page
export const useAllBatches = (filters?: BatchFilters, companyId?: string) => {
  return useQuery({
    queryKey: ['all-batches', filters, companyId],
    queryFn: async () => {
      let query = supabase
        .from('item_batches')
        .select(`
          *,
          warehouse_items!inner(name, item_code, is_batch_tracked)
        `)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply warehouse item filter
      if (filters?.warehouseItemId) {
        query = query.eq('warehouse_item_id', filters.warehouseItemId);
      }

      // Apply company filter at application level
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data as ItemBatch[];

      // Apply search filter (client-side for batch_number and item name)
      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredData = filteredData.filter(batch => 
          batch.batch_number.toLowerCase().includes(searchLower) ||
          batch.warehouse_item?.name?.toLowerCase().includes(searchLower) ||
          batch.warehouse_item?.item_code?.toLowerCase().includes(searchLower)
        );
      }

      // Apply expiry filter (client-side)
      if (filters?.expiryFilter && filters.expiryFilter !== 'all') {
        const today = new Date();
        const thirtyDaysFromNow = addDays(today, 30);

        filteredData = filteredData.filter(batch => {
          if (filters.expiryFilter === 'not_set') {
            return !batch.expiry_date;
          }
          if (!batch.expiry_date) return false;
          
          const expiryDate = parseISO(batch.expiry_date);
          
          if (filters.expiryFilter === 'expired') {
            return isBefore(expiryDate, today);
          }
          if (filters.expiryFilter === 'expiring_soon') {
            return isAfter(expiryDate, today) && isBefore(expiryDate, thirtyDaysFromNow);
          }
          return true;
        });
      }

      return filteredData;
    },
  });
};

// Get batch summary statistics
export const useBatchSummary = () => {
  return useQuery({
    queryKey: ['batch-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_batches')
        .select('id, status, quantity_received, quantity_remaining, expiry_date');

      if (error) throw error;

      const today = new Date();
      const thirtyDaysFromNow = addDays(today, 30);

      const summary: BatchSummary = {
        total_active: 0,
        expiring_soon: 0,
        expired: 0,
        low_stock: 0,
      };

      data?.forEach(batch => {
        if (batch.status === 'active') {
          summary.total_active++;
        }
        if (batch.status === 'expired') {
          summary.expired++;
        }
        if (batch.expiry_date) {
          const expiryDate = parseISO(batch.expiry_date);
          if (isAfter(expiryDate, today) && isBefore(expiryDate, thirtyDaysFromNow)) {
            summary.expiring_soon++;
          }
        }
        // Low stock: remaining < 10% of received
        if (batch.quantity_received > 0 && 
            (batch.quantity_remaining / batch.quantity_received) < 0.1 &&
            batch.quantity_remaining > 0) {
          summary.low_stock++;
        }
      });

      return summary;
    },
  });
};

// Update batch status
export const useUpdateBatchStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId, status, notes }: { batchId: string; status: BatchStatus; notes?: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { data, error } = await supabase
        .from('item_batches')
        .update(updateData)
        .eq('id', batchId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['all-batches'] });
      queryClient.invalidateQueries({ queryKey: ['batch-summary'] });
      toast({
        title: 'Success',
        description: 'Batch status updated successfully',
      });
    },
    onError: (error) => {
      console.error('Error updating batch status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update batch status',
        variant: 'destructive',
      });
    },
  });
};

// Get batch-tracked warehouse items for filter dropdown
export const useBatchTrackedItems = () => {
  return useQuery({
    queryKey: ['batch-tracked-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .select('id, name, item_code')
        .eq('is_batch_tracked', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
};
