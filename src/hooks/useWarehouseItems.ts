import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseItem, CreateWarehouseItemData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useCurrentUserLocationPermissions } from '@/hooks/useCurrentUserLocationPermissions';

export const useWarehouseItems = (options?: { skipCompanyFilter?: boolean; disableFetch?: boolean }) => {
  const skipCompanyFilter = options?.skipCompanyFilter ?? false;
  const disableFetch = options?.disableFetch ?? false;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany, isViewingAllCompanies } = useCompany();
  const { data: permissions } = useCurrentUserLocationPermissions();

  const {
    data: items = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['warehouse-items', skipCompanyFilter ? 'all' : selectedCompany?.id, isViewingAllCompanies, permissions?.viewAllLocations, permissions?.viewLocationIds, permissions?.editLocationIds],
    queryFn: async () => {
      // Cursor-based batching to bypass the 1,000-row Supabase limit
      const BATCH_SIZE = 1000;
      const allData: any[] = [];
      let cursor: { created_at: string; id: string } | null = null;

      while (true) {
        let query = supabase
          .from('warehouse_items')
          .select(`
            *,
            supplier:suppliers(id, name)
          `);

        // Filter by company if not viewing all companies (skip for global item master)
        if (!skipCompanyFilter && !isViewingAllCompanies && selectedCompany?.id) {
          query = query.eq('company_id', selectedCompany.id);
        }

        query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

        if (cursor) {
          query = query.or(
            `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
          );
        }

        query = query.limit(BATCH_SIZE);

        const { data: batch, error: batchError } = await query;
        if (batchError) throw batchError;

        const rows = batch || [];
        allData.push(...rows);

        if (rows.length < BATCH_SIZE) break;
        const last = rows[rows.length - 1];
        cursor = { created_at: last.created_at, id: last.id };
      }

      const data = allData;

      if (error) throw error;

      // Fetch bin allocations for all items using separate queries (more reliable than nested syntax)
      const itemIds = data?.map((item: any) => item.id) || [];
      let itemsWithBins = data || [];

      if (itemIds.length > 0) {
        // Fetch all bins with location_id for permission filtering
        let binsQuery = supabase
          .from('warehouse_bins')
          .select('id, bin_code, name, location_id');

        // Filter bins by permitted locations if user doesn't have view_all_locations
        if (permissions && !permissions.viewAllLocations) {
          const permittedLocationIds = [...new Set([...permissions.viewLocationIds, ...permissions.editLocationIds])];
          if (permittedLocationIds.length > 0) {
            binsQuery = binsQuery.in('location_id', permittedLocationIds);
          } else {
            // No location permissions — return items with no bin data
            return (data || []).map((item: any) => ({ ...item, bins: null })) as WarehouseItem[];
          }
        }

        const { data: bins } = await binsQuery;

        // Create a set of permitted bin IDs for fast lookup
        const permittedBinIds = new Set(bins?.map(b => b.id) || []);

        // Fetch ALL allocations with stock
        const { data: allocations, error: allocError } = await supabase
          .from('warehouse_bin_allocations')
          .select('warehouse_item_id, bin_id, available_quantity')
          .gt('available_quantity', 0);

        const itemIdSet = new Set(itemIds);

        if (!allocError && allocations && bins) {
          const binLookup = new Map(bins.map(b => [b.id, b]));

          const binsByItem: Record<string, Array<{ id: string; bin_code: string; name: string; quantity: number }>> = {};
          allocations.forEach((alloc: any) => {
            const itemId = alloc.warehouse_item_id;
            if (!itemIdSet.has(itemId)) return;
            
            // Only include allocations from permitted bins
            if (!permittedBinIds.has(alloc.bin_id)) return;
            
            const bin = binLookup.get(alloc.bin_id);
            if (!bin) return;
            
            if (!binsByItem[itemId]) binsByItem[itemId] = [];
            
            const existingBin = binsByItem[itemId].find(b => b.id === bin.id);
            if (existingBin) {
              existingBin.quantity += Number(alloc.available_quantity);
            } else {
              binsByItem[itemId].push({
                id: bin.id,
                bin_code: bin.bin_code,
                name: bin.name,
                quantity: Number(alloc.available_quantity)
              });
            }
          });

          itemsWithBins = data?.map((item: any) => ({
            ...item,
            bins: binsByItem[item.id] || null
          })) || [];
        }
      }

      return itemsWithBins as WarehouseItem[];
    },
    enabled: !disableFetch && (skipCompanyFilter || !!(isViewingAllCompanies || selectedCompany?.id)),
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: CreateWarehouseItemData & { initialStock?: number; initialUnitCost?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (!selectedCompany?.id) {
        throw new Error('No company selected');
      }

      const { initialStock, initialUnitCost, ...itemDataWithoutStock } = itemData;

      const { data, error } = await supabase
        .from('warehouse_items')
        .insert({
          ...itemDataWithoutStock,
          company_id: selectedCompany.id,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return { item: data, initialStock, initialUnitCost };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success", 
        description: "Item created successfully",
      });
      
      // Create initial stock transaction if provided
      if (result.initialStock && result.initialStock > 0) {
        // We'll handle this in the component using the returned data
      }
    },
    onError: (error: any) => {
      console.error('Error creating item:', error);
      
      let errorMessage = "Failed to create item";
      
      // Handle specific constraint violations
      if (error?.message?.includes('warehouse_items_sku_company_id_key')) {
        errorMessage = "An item with this SKU already exists for the selected company";
      } else if (error?.message?.includes('warehouse_items_barcode_key')) {
        errorMessage = "An item with this barcode already exists";
      } else if (error?.message?.includes('warehouse_items_item_code_company_id_key')) {
        errorMessage = "An item with this code already exists in this company";
      } else if (error?.message?.includes('warehouse_items_item_code_key')) {
        errorMessage = "An item with this code already exists";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...itemData }: Partial<WarehouseItem> & { id: string }) => {
      console.log('Updating item with ID:', id);
      console.log('Update payload:', itemData);
      
      const { data, error } = await supabase
        .from('warehouse_items')
        .update(itemData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      console.log('Update successful, returned data:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error updating item:', error);
      
      let errorMessage = "Failed to update item";
      
      // Handle specific constraint violations
      if (error?.message?.includes('warehouse_items_sku_company_id_key')) {
        errorMessage = "An item with this SKU already exists for the selected company";
      } else if (error?.message?.includes('warehouse_items_barcode_key')) {
        errorMessage = "An item with this barcode already exists";
      } else if (error?.message?.includes('warehouse_items_item_code_company_id_key')) {
        errorMessage = "An item with this code already exists in this company";
      } else if (error?.message?.includes('warehouse_items_item_code_key')) {
        errorMessage = "An item with this code already exists";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ id, forceDelete }: { id: string; forceDelete: boolean }) => {
      if (forceDelete) {
        // Force delete - this will cascade delete references
        const { error } = await supabase
          .from('warehouse_items')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } else {
        // Safe delete - check for references first
        const { error } = await supabase
          .from('warehouse_items')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting item:', error);
      
      let errorMessage = "Failed to delete item";
      
      // Handle foreign key constraint errors
      if (error?.message?.includes('foreign key constraint') || 
          error?.message?.includes('violates foreign key') ||
          error?.code === '23503') {
        errorMessage = "Cannot delete item as it is referenced in other records. Please mark it as inactive instead.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const markItemInactiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: "Item marked as inactive successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error marking item inactive:', error);
      toast({
        title: "Error",
        description: "Failed to mark item as inactive",
        variant: "destructive",
      });
    }
  });

  const bulkCreateItemsMutation = useMutation({
    mutationFn: async (itemsData: CreateWarehouseItemData[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (!selectedCompany?.id) {
        throw new Error('No company selected');
      }

      const itemsWithUser = itemsData.map(item => ({
        ...item,
        company_id: selectedCompany.id,
        created_by: user.id
      }));

      const { data, error } = await supabase
        .from('warehouse_items')
        .insert(itemsWithUser)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: `Successfully imported ${data.length} items`,
      });
    },
    onError: (error: any) => {
      console.error('Error bulk creating items:', error);
      
      let errorMessage = "Failed to import items";
      
      if (error?.message?.includes('warehouse_items_sku_company_id_key')) {
        errorMessage = "One or more items have duplicate SKU for the company";
      } else if (error?.message?.includes('warehouse_items_barcode_key')) {
        errorMessage = "One or more items have duplicate barcode";
      } else if (error?.message?.includes('warehouse_items_item_code_company_id_key')) {
        errorMessage = "One or more items have an item code that already exists in this company";
      } else if (error?.message?.includes('warehouse_items_item_code_key')) {
        errorMessage = "One or more items have duplicate item code";
      } else if (error?.message?.includes('row-level security')) {
        errorMessage = "Permission denied: row-level security policy violation";
      } else if (error?.message) {
        errorMessage = `Import failed: ${error.message}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  return {
    items,
    isLoading,
    error,
    createItem: createItemMutation.mutate,
    createItemAsync: createItemMutation.mutateAsync,
    updateItem: updateItemMutation.mutate,
    deleteItem: ({ id, forceDelete = false }: { id: string; forceDelete?: boolean }) => 
      deleteItemMutation.mutate({ id, forceDelete }),
    markItemInactive: markItemInactiveMutation.mutate,
    isCreating: createItemMutation.isPending,
    isUpdating: updateItemMutation.isPending,
    isDeleting: deleteItemMutation.isPending,
    isMarkingInactive: markItemInactiveMutation.isPending,
    bulkCreateItems: bulkCreateItemsMutation.mutate,
    bulkCreateItemsAsync: bulkCreateItemsMutation.mutateAsync,
    isBulkCreating: bulkCreateItemsMutation.isPending,
  };
};