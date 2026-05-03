import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import type { 
  WarehouseBinAllocation, 
  CreateBinAllocationData,
  BinAllocationWithDetails 
} from '@/types/warehouseReservation';

export function useWarehouseBinAllocations(options?: { disableFetch?: boolean }) {
  const queryClient = useQueryClient();
  const { selectedCompany, isViewingAllCompanies } = useCompany();

  // Fetch all bin allocations with details
  const { data: binAllocations, isLoading, error } = useQuery({
    queryKey: ['warehouse-bin-allocations', selectedCompany?.id, isViewingAllCompanies],
    queryFn: async () => {
      const { data: allAllocations, error: fetchError } = await supabase
        .from('warehouse_bin_allocations')
        .select(`
          *,
          warehouse_item:warehouse_items!warehouse_bin_allocations_warehouse_item_id_fkey(
            item_code,
            name,
            company_id
          ),
          warehouse_bin:warehouse_bins!warehouse_bin_allocations_bin_id_fkey(
            bin_code,
            name,
            location_id,
            warehouse_location:warehouse_locations!warehouse_bins_location_id_fkey(
              id,
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Filter by warehouse item's company_id (not allocation's company_id)
      // This ensures allocations show if the item belongs to the selected company
      if (!isViewingAllCompanies && selectedCompany?.id) {
        return (allAllocations as BinAllocationWithDetails[]).filter(
          (allocation) => (allocation.warehouse_item as { item_code: string; name: string; company_id: string | null })?.company_id === selectedCompany.id
        );
      }

      return allAllocations as BinAllocationWithDetails[];
    },
    enabled: !options?.disableFetch && !!(isViewingAllCompanies || selectedCompany?.id),
    // Live-critical: bin allocations drive available stock numbers.
    staleTime: 0,
    refetchOnMount: 'always',
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

  // Reconcile stock: sync bin allocations with warehouse_items.current_stock
  const reconcileStockMutation = useMutation({
    mutationFn: async (selectedLocationId?: string | null) => {
      console.log('=== Starting stock reconciliation ===');
      toast.info('Starting stock reconciliation...');
      
      if (!selectedCompany?.id) {
        throw new Error('Please select a company first');
      }

      const { data: user } = await supabase.auth.getUser();
      let consolidatedCount = 0;

      // ============ STEP 0: Consolidate duplicate allocations ============
      console.log('=== Step 0: Consolidating duplicate allocations ===');
      
      // Get all allocations for this company
      const { data: allAllocations, error: allAllocError } = await supabase
        .from('warehouse_bin_allocations')
        .select('id, warehouse_item_id, bin_id, allocated_quantity, reserved_quantity')
        .eq('company_id', selectedCompany.id);

      if (allAllocError) {
        console.error('Failed to fetch all allocations:', allAllocError);
        throw allAllocError;
      }

      // Group by (warehouse_item_id + bin_id)
      const allocationsByKey = new Map<string, typeof allAllocations>();
      allAllocations?.forEach(alloc => {
        const key = `${alloc.warehouse_item_id}|${alloc.bin_id}`;
        if (!allocationsByKey.has(key)) {
          allocationsByKey.set(key, []);
        }
        allocationsByKey.get(key)!.push(alloc);
      });

      // Find and consolidate duplicates
      for (const [key, allocations] of allocationsByKey) {
        if (allocations.length <= 1) continue;
        
        // Sum all quantities
        const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocated_quantity || 0), 0);
        const totalReserved = allocations.reduce((sum, a) => sum + (a.reserved_quantity || 0), 0);
        
        console.log(`Consolidating ${allocations.length} duplicates for key ${key}: total=${totalAllocated}`);
        
        // Update first allocation with totals
        const { error: updateError } = await supabase
          .from('warehouse_bin_allocations')
          .update({ 
            allocated_quantity: totalAllocated,
            reserved_quantity: totalReserved
          })
          .eq('id', allocations[0].id);
        
        if (updateError) {
          console.error(`Error updating allocation ${allocations[0].id}:`, updateError);
          continue;
        }
        
        // Delete duplicate records
        const duplicateIds = allocations.slice(1).map(a => a.id);
        const { error: deleteError } = await supabase
          .from('warehouse_bin_allocations')
          .delete()
          .in('id', duplicateIds);
        
        if (deleteError) {
          console.error(`Error deleting duplicates:`, deleteError);
        } else {
          consolidatedCount += duplicateIds.length;
          console.log(`✓ Consolidated ${duplicateIds.length} duplicates into allocation ${allocations[0].id}`);
        }
      }

      if (consolidatedCount > 0) {
        console.log(`=== Consolidated ${consolidatedCount} duplicate allocations ===`);
        toast.info(`Consolidated ${consolidatedCount} duplicate allocations`);
      }

      // ============ STEP 1: Batch reconcile via RPC ============
      const { data: items, error: itemsError } = await supabase
        .from('warehouse_items')
        .select('id, location_id')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'active');

      if (itemsError) {
        console.error('Failed to fetch items:', itemsError);
        throw itemsError;
      }

      const itemIds = (items || []).map(i => i.id);
      console.log(`Found ${itemIds.length} active items, sending to batch RPC`);

      if (itemIds.length === 0) {
        return { reconciled: 0, created: 0, updated: 0, skipped: 0, consolidated: consolidatedCount };
      }

      // ============ Build overrides for items missing location_id ============
      let overrides: Record<string, { locationId: string; binId: string }> = {};

      if (selectedLocationId) {
        // Find items without a location_id
        const itemsNeedingLocation = (items || []).filter(i => !i.location_id);
        
        if (itemsNeedingLocation.length > 0) {
          console.log(`${itemsNeedingLocation.length} items missing location_id, resolving bin at selected location`);
          
          // Find first active bin at the selected location
          const { data: binAtLocation, error: binError } = await supabase
            .from('warehouse_bins')
            .select('id, bin_code')
            .eq('location_id', selectedLocationId)
            .eq('status', 'active')
            .order('bin_code', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (binError) {
            console.error('Failed to find bin at selected location:', binError);
          }

          if (binAtLocation) {
            console.log(`Using bin ${binAtLocation.bin_code} (${binAtLocation.id}) for ${itemsNeedingLocation.length} items`);
            for (const item of itemsNeedingLocation) {
              overrides[item.id] = {
                locationId: selectedLocationId,
                binId: binAtLocation.id,
              };
            }
          } else {
            console.warn('No active bin found at selected location, items without location will be skipped');
            toast.warning('No active bin found at the selected location. Items without a location will be skipped.');
          }
        }
      } else {
        const itemsWithoutLocation = (items || []).filter(i => !i.location_id);
        if (itemsWithoutLocation.length > 0) {
          console.warn(`${itemsWithoutLocation.length} items have no location_id and no location selected — these will be skipped`);
        }
      }

      const { data: rpcResults, error: rpcError } = await supabase.rpc('reconcile_stock_batch', {
        p_item_ids: itemIds,
        p_company_id: selectedCompany.id,
        p_overrides: overrides as any,
        p_user_id: user.user?.id || null,
        p_location_id: selectedLocationId ?? null,
      } as any);

      if (rpcError) {
        console.error('Batch reconciliation RPC failed:', rpcError);
        throw rpcError;
      }

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      (rpcResults || []).forEach((r: any) => {
        if (r.action === 'adjusted' || r.action === 'created') {
          if (r.action === 'created') createdCount++;
          else updatedCount++;
        } else if (r.action === 'blocked' || r.action === 'error') {
          skippedCount++;
        }
        console.log(`${r.item_code}: ${r.action} - ${r.message}`);
      });

      console.log(`\n=== Reconciliation complete ===`);
      console.log(`Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}, Consolidated: ${consolidatedCount}`);

      return { reconciled: createdCount + updatedCount, created: createdCount, updated: updatedCount, skipped: skippedCount, consolidated: consolidatedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      if (result.reconciled === 0 && result.skipped === 0 && result.consolidated === 0) {
        toast.info('All stock is already reconciled');
      } else {
        const messages: string[] = [];
        if (result.consolidated > 0) messages.push(`${result.consolidated} duplicates consolidated`);
        if (result.reconciled > 0) messages.push(`${result.reconciled} items reconciled`);
        toast.success(messages.join(', ') || 'Stock reconciliation complete');
      }
      if (result.skipped > 0) {
        toast.warning(`${result.skipped} items skipped`);
      }
    },
    onError: (error: Error) => {
      console.error('Reconciliation failed:', error);
      toast.error(`Reconciliation failed: ${error.message}`);
    },
  });

  // Fix allocations based on transfer history - creates proper allocations at destination locations
  const fixAllocationsFromHistoryMutation = useMutation({
    mutationFn: async () => {
      console.log('=== Starting Fix Allocations from Transfer History ===');
      toast.info('Analyzing transfer history...');
      
      if (!selectedCompany?.id) {
        throw new Error('Please select a company first');
      }

      const { data: user } = await supabase.auth.getUser();

      // Step 1: Get all completed transfer items with their transfer details
      const { data: transferItems, error: transferError } = await supabase
        .from('stock_transfer_items')
        .select(`
          id,
          warehouse_item_id,
          item_name,
          quantity_requested,
          status,
          stock_transfer_requests!inner (
            id,
            transfer_number,
            from_location_id,
            to_location_id,
            status,
            company_id
          )
        `)
        .eq('status', 'completed')
        .eq('stock_transfer_requests.status', 'completed')
        .eq('stock_transfer_requests.company_id', selectedCompany.id);

      if (transferError) {
        console.error('Failed to fetch transfers:', transferError);
        throw transferError;
      }

      console.log(`Found ${transferItems?.length || 0} completed transfer items`);

      if (!transferItems || transferItems.length === 0) {
        return { fixed: 0, created: 0, updated: 0 };
      }

      // Step 2: Build a map of item -> location -> net quantity transferred IN
      const locationStockMap = new Map<string, Map<string, number>>();
      
      for (const item of transferItems) {
        const transfer = item.stock_transfer_requests as any;
        const itemId = item.warehouse_item_id;
        const qty = item.quantity_requested || 0;
        
        if (!locationStockMap.has(itemId)) {
          locationStockMap.set(itemId, new Map());
        }
        
        const itemLocations = locationStockMap.get(itemId)!;
        
        // Add to destination location
        const destId = transfer.to_location_id;
        itemLocations.set(destId, (itemLocations.get(destId) || 0) + qty);
        
        console.log(`Transfer ${transfer.transfer_number}: ${item.item_name} +${qty} to ${destId}`);
      }

      let createdCount = 0;
      let updatedCount = 0;

      // Step 3: For each item+location, ensure proper allocation exists
      for (const [itemId, locations] of locationStockMap) {
        for (const [locationId, expectedQty] of locations) {
          if (expectedQty <= 0) continue;
          
          console.log(`\nProcessing: Item ${itemId} at location ${locationId}, expected: ${expectedQty}`);

          // Get bin at this location
          const { data: bins } = await supabase
            .from('warehouse_bins')
            .select('id, bin_code, location_id')
            .eq('location_id', locationId)
            .limit(1);

          let binId: string;

          if (bins && bins.length > 0) {
            binId = bins[0].id;
            console.log(`Found existing bin: ${bins[0].bin_code}`);
          } else {
            // Create a default bin at this location
            const { data: location } = await supabase
              .from('warehouse_locations')
              .select('name')
              .eq('id', locationId)
              .single();
            
            const locationName = location?.name || 'Unknown';
            
            const { data: newBin, error: createBinError } = await supabase
              .from('warehouse_bins')
              .insert({
                location_id: locationId,
                bin_code: locationName.substring(0, 10).toUpperCase().replace(/\s/g, '-'),
                name: `${locationName} - Default Bin`,
                company_id: selectedCompany.id,
                current_quantity: 0,
                max_capacity: 10000,
              })
              .select()
              .single();

            if (createBinError) {
              console.error(`Failed to create bin at location ${locationId}:`, createBinError);
              continue;
            }
            
            binId = newBin.id;
            console.log(`Created new bin: ${newBin.bin_code}`);
          }

          // Check if allocation exists
          const { data: existingAlloc } = await supabase
            .from('warehouse_bin_allocations')
            .select('id, allocated_quantity')
            .eq('warehouse_item_id', itemId)
            .eq('bin_id', binId)
            .maybeSingle();

          if (existingAlloc) {
            // Check if it needs updating (if current allocation is less than expected from transfers)
            if ((existingAlloc.allocated_quantity || 0) < expectedQty) {
              const { error: updateError } = await supabase
                .from('warehouse_bin_allocations')
                .update({ allocated_quantity: expectedQty })
                .eq('id', existingAlloc.id);

              if (updateError) {
                console.error(`Failed to update allocation:`, updateError);
              } else {
                console.log(`✓ Updated allocation: ${existingAlloc.allocated_quantity} -> ${expectedQty}`);
                updatedCount++;
              }
            } else {
              console.log(`Allocation already sufficient: ${existingAlloc.allocated_quantity} >= ${expectedQty}`);
            }
          } else {
            // Create new allocation
            const { error: insertError } = await supabase
              .from('warehouse_bin_allocations')
              .insert({
                warehouse_item_id: itemId,
                bin_id: binId,
                allocated_quantity: expectedQty,
                reserved_quantity: 0,
                company_id: selectedCompany.id,
                created_by: user.user?.id,
              });

            if (insertError) {
              console.error(`Failed to create allocation:`, insertError);
            } else {
              console.log(`✓ Created allocation: ${expectedQty} units`);
              createdCount++;
            }
          }
        }
      }

      console.log(`\n=== Fix from history complete ===`);
      console.log(`Created: ${createdCount}, Updated: ${updatedCount}`);

      return { fixed: createdCount + updatedCount, created: createdCount, updated: updatedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      if (result.fixed === 0) {
        toast.info('All allocations from transfer history are already correct');
      } else {
        toast.success(`Fixed ${result.fixed} allocations from history (${result.created} created, ${result.updated} updated)`);
      }
    },
    onError: (error: Error) => {
      console.error('Fix from history failed:', error);
      toast.error(`Fix from history failed: ${error.message}`);
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
    reconcileStock: (locationId?: string | null) => reconcileStockMutation.mutate(locationId),
    fixAllocationsFromHistory: fixAllocationsFromHistoryMutation.mutate,
    isCreating: createAllocationMutation.isPending,
    isUpdating: updateAllocationMutation.isPending,
    isDeleting: deleteAllocationMutation.isPending,
    isAdjusting: adjustAllocationMutation.isPending,
    isMigrating: migrateAllocationsMutation.isPending,
    isReconciling: reconcileStockMutation.isPending,
    isFixingFromHistory: fixAllocationsFromHistoryMutation.isPending,
  };
}
