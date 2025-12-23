import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import type { 
  WarehouseBinAllocation, 
  CreateBinAllocationData,
  BinAllocationWithDetails 
} from '@/types/warehouseReservation';

export function useWarehouseBinAllocations() {
  const queryClient = useQueryClient();
  const { selectedCompany, isViewingAllCompanies } = useCompany();

  // Fetch all bin allocations with details
  const { data: binAllocations, isLoading, error } = useQuery({
    queryKey: ['warehouse-bin-allocations', selectedCompany?.id, isViewingAllCompanies],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_bin_allocations')
        .select(`
          *,
          warehouse_item:warehouse_items!warehouse_bin_allocations_warehouse_item_id_fkey(
            item_code,
            name
          ),
          warehouse_bin:warehouse_bins!warehouse_bin_allocations_bin_id_fkey(
            bin_code,
            name
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by company if not viewing all companies
      if (!isViewingAllCompanies && selectedCompany?.id) {
        query = query.eq('company_id', selectedCompany.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as BinAllocationWithDetails[];
    },
    enabled: !!(isViewingAllCompanies || selectedCompany?.id),
  });

  // Get allocations for a specific item
  const getAllocationsForItem = async (warehouseItemId: string) => {
    const { data, error } = await supabase
      .from('warehouse_bin_allocations')
      .select(`
        *,
        warehouse_bin:warehouse_bins!warehouse_bin_allocations_bin_id_fkey(
          bin_code,
          name
        )
      `)
      .eq('warehouse_item_id', warehouseItemId)
      .gt('available_quantity', 0)
      .order('available_quantity', { ascending: false });

    if (error) throw error;
    return data as BinAllocationWithDetails[];
  };

  // Get allocations for a specific bin
  const getAllocationsForBin = async (binId: string) => {
    const { data, error } = await supabase
      .from('warehouse_bin_allocations')
      .select(`
        *,
        warehouse_item:warehouse_items!warehouse_bin_allocations_warehouse_item_id_fkey(
          item_code,
          name
        )
      `)
      .eq('bin_id', binId)
      .order('allocated_quantity', { ascending: false });

    if (error) throw error;
    return data as BinAllocationWithDetails[];
  };

  // Create bin allocation
  const createAllocationMutation = useMutation({
    mutationFn: async (data: CreateBinAllocationData) => {
      const { data: user } = await supabase.auth.getUser();
      
      if (!selectedCompany?.id) {
        throw new Error('Please select a company first');
      }
      
      const { data: allocation, error } = await supabase
        .from('warehouse_bin_allocations')
        .insert({
          ...data,
          company_id: selectedCompany.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return allocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Bin allocation created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create bin allocation: ${error.message}`);
    },
  });

  // Update bin allocation
  const updateAllocationMutation = useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<WarehouseBinAllocation> 
    }) => {
      const { data, error } = await supabase
        .from('warehouse_bin_allocations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Bin allocation updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update bin allocation: ${error.message}`);
    },
  });

  // Delete bin allocation
  const deleteAllocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouse_bin_allocations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Bin allocation deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete bin allocation: ${error.message}`);
    },
  });

  // Adjust allocation quantity (for stock movements)
  const adjustAllocationMutation = useMutation({
    mutationFn: async ({
      id,
      quantityChange,
    }: {
      id: string;
      quantityChange: number;
    }) => {
      // Get current allocation
      const { data: allocation, error: fetchError } = await supabase
        .from('warehouse_bin_allocations')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const newQuantity = allocation.allocated_quantity + quantityChange;

      if (newQuantity < 0) {
        throw new Error('Cannot reduce allocation below zero');
      }

      if (newQuantity < allocation.reserved_quantity) {
        throw new Error('Cannot reduce allocation below reserved quantity');
      }

      const { data, error } = await supabase
        .from('warehouse_bin_allocations')
        .update({ allocated_quantity: newQuantity })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Bin allocation adjusted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to adjust allocation: ${error.message}`);
    },
  });

  return {
    binAllocations,
    isLoading,
    error,
    getAllocationsForItem,
    getAllocationsForBin,
    createAllocation: createAllocationMutation.mutate,
    updateAllocation: updateAllocationMutation.mutate,
    deleteAllocation: deleteAllocationMutation.mutate,
    adjustAllocation: adjustAllocationMutation.mutate,
    isCreating: createAllocationMutation.isPending,
    isUpdating: updateAllocationMutation.isPending,
    isDeleting: deleteAllocationMutation.isPending,
    isAdjusting: adjustAllocationMutation.isPending,
  };
}
