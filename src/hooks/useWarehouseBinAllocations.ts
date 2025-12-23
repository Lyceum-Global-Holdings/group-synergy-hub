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

  // Migration function to fix bin allocations based on item's location_id
  const migrateAllocationsMutation = useMutation({
    mutationFn: async () => {
      console.log('=== Starting bin allocation migration ===');
      toast.info('Starting migration...');
      
      // Step 1: Get all items with their location_id
      const { data: items, error: itemsError } = await supabase
        .from('warehouse_items')
        .select('id, location_id, name, item_code')
        .not('location_id', 'is', null);
      
      if (itemsError) {
        console.error('Failed to fetch items:', itemsError);
        throw itemsError;
      }
      
      console.log(`Found ${items?.length || 0} items with location_id`);
      
      if (!items || items.length === 0) {
        return { fixed: 0, total: 0, skipped: 0 };
      }
      
      let fixedCount = 0;
      let totalAllocations = 0;
      let skippedItems = 0;
      
      for (const item of items) {
        console.log(`\nProcessing item: ${item.item_code} (location_id: ${item.location_id})`);
        
        // Step 2: Get a bin at the item's location
        const { data: correctBins, error: binsError } = await supabase
          .from('warehouse_bins')
          .select('id, bin_code')
          .eq('location_id', item.location_id)
          .limit(1);
        
        if (binsError) {
          console.error(`Error fetching bins for location ${item.location_id}:`, binsError);
          skippedItems++;
          continue;
        }
        
        if (!correctBins || correctBins.length === 0) {
          console.warn(`No bins found at location ${item.location_id} for item ${item.item_code}`);
          skippedItems++;
          continue;
        }
        
        const correctBinId = correctBins[0].id;
        const correctBinCode = correctBins[0].bin_code;
        console.log(`Correct bin for ${item.item_code}: ${correctBinCode} (${correctBinId})`);
        
        // Step 3: Get ALL allocations for this item (simplified query without !inner)
        const { data: allocations, error: allocError } = await supabase
          .from('warehouse_bin_allocations')
          .select('id, bin_id')
          .eq('warehouse_item_id', item.id);
        
        if (allocError) {
          console.error(`Error fetching allocations for item ${item.item_code}:`, allocError);
          skippedItems++;
          continue;
        }
        
        if (!allocations || allocations.length === 0) {
          console.log(`No allocations found for item ${item.item_code}`);
          continue;
        }
        
        // Filter to only those in wrong bins
        const wrongAllocations = allocations.filter(a => a.bin_id !== correctBinId);
        
        if (wrongAllocations.length === 0) {
          console.log(`All ${allocations.length} allocations for ${item.item_code} are already in correct bin`);
          continue;
        }
        
        console.log(`Found ${wrongAllocations.length} allocations in wrong bins for ${item.item_code}`);
        totalAllocations += wrongAllocations.length;
        
        // Step 4: Update each allocation to use the correct bin
        for (const alloc of wrongAllocations) {
          const { error: updateError } = await supabase
            .from('warehouse_bin_allocations')
            .update({ bin_id: correctBinId })
            .eq('id', alloc.id);
          
          if (updateError) {
            console.error(`Error updating allocation ${alloc.id}:`, updateError);
          } else {
            fixedCount++;
            console.log(`✓ Fixed allocation ${alloc.id}: moved to bin ${correctBinCode}`);
          }
        }
      }
      
      console.log(`\n=== Migration complete ===`);
      console.log(`Fixed: ${fixedCount}/${totalAllocations} allocations`);
      console.log(`Skipped items: ${skippedItems}`);
      
      return { fixed: fixedCount, total: totalAllocations, skipped: skippedItems };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      if (result.total === 0) {
        toast.info('All bin allocations are already correct');
      } else {
        toast.success(`Fixed ${result.fixed} of ${result.total} bin allocations`);
      }
      if (result.skipped > 0) {
        toast.warning(`${result.skipped} items skipped (no bin at their location)`);
      }
    },
    onError: (error: Error) => {
      console.error('Migration failed:', error);
      toast.error(`Migration failed: ${error.message}`);
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
    migrateAllocationsToCorrectLocation: migrateAllocationsMutation.mutate,
    isCreating: createAllocationMutation.isPending,
    isUpdating: updateAllocationMutation.isPending,
    isDeleting: deleteAllocationMutation.isPending,
    isAdjusting: adjustAllocationMutation.isPending,
    isMigrating: migrateAllocationsMutation.isPending,
  };
}
