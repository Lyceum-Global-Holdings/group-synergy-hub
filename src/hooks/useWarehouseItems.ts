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
          .from('warehouse_items_full')
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

      // error handling is done per-batch above

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
          }
          // No explicit permissions = fail-open: show all bins (no filter applied)
        }

        const { data: bins } = await binsQuery;

        // Create a set of permitted bin IDs for fast lookup
        const permittedBinIds = new Set(bins?.map(b => b.id) || []);

        // Fetch ALL allocations with stock
        // Batch-fetch allocations to bypass 1,000-row limit
        const allAllocations: any[] = [];
        let allocCursor: { id: string } | null = null;
        let allocError: any = null;
        while (true) {
          let aq = supabase
            .from('warehouse_bin_allocations')
            .select('id, warehouse_item_id, bin_id, available_quantity')
            .gt('available_quantity', 0)
            .order('id', { ascending: true });
          if (allocCursor) {
            aq = aq.gt('id', allocCursor.id);
          }
          aq = aq.limit(1000);
          const { data: aBatch, error: aErr } = await aq;
          if (aErr) { allocError = aErr; break; }
          const aRows = aBatch || [];
          allAllocations.push(...aRows);
          if (aRows.length < 1000) break;
          allocCursor = { id: aRows[aRows.length - 1].id };
        }
        const allocations = allAllocations;

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
    // Project default 30s freshness. Realtime subscriptions invalidate this key
    // on stock changes (see useRealtimeStockUpdates), so list browsing stays
    // accurate without re-fetching all 14k+ rows on every mount.
    // Stock-critical screens (MaterialIssue, GRN, StockAdjustment) use their
    // own dedicated hooks with staleTime: 0.
    staleTime: 30_000,
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: CreateWarehouseItemData & { initialStock?: number; initialUnitCost?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (!selectedCompany?.id) {
        throw new Error('No company selected');
      }

      const { initialStock, initialUnitCost, ...itemDataWithoutStock } = itemData;

      // Stage 1: every inventory row must link to a catalog entry. Resolve by item_code.
      const { data: catalogRow, error: catalogErr } = await supabase
        .from('warehouse_item_catalog')
        .select('id')
        .eq('item_code', itemDataWithoutStock.item_code)
        .maybeSingle();
      if (catalogErr) throw catalogErr;
      if (!catalogRow) {
        throw new Error(`Catalog entry missing for item_code ${itemDataWithoutStock.item_code}. Create the catalog row first.`);
      }

      // Stage 6: mirrored master fields no longer live on warehouse_items.
      // Use upsert_warehouse_inventory RPC for per-company fields only.
      const { data: newId, error } = await supabase.rpc('upsert_warehouse_inventory', {
        p_company_id: selectedCompany.id,
        p_catalog_item_id: catalogRow.id,
        p_location_id: itemDataWithoutStock.location_id ?? null,
        p_base_uom: itemDataWithoutStock.base_uom ?? null,
        p_secondary_uom: itemDataWithoutStock.secondary_uom ?? null,
        p_track_secondary: itemDataWithoutStock.track_secondary_quantity ?? false,
        p_reorder_level: itemDataWithoutStock.reorder_level ?? null,
        p_min_stock_level: itemDataWithoutStock.min_stock_level ?? null,
        p_max_stock_level: itemDataWithoutStock.max_stock_level ?? null,
        p_unit_cost: itemDataWithoutStock.unit_cost ?? null,
        p_selling_price: itemDataWithoutStock.selling_price ?? null,
        p_status: itemDataWithoutStock.status ?? 'active',
        p_notes: itemDataWithoutStock.notes ?? null,
      });
      if (error) throw error;

      const { data: row, error: rowErr } = await supabase
        .from('warehouse_items_full')
        .select('*')
        .eq('id', newId as unknown as string)
        .single();
      if (rowErr) throw rowErr;
      return { item: row, initialStock, initialUnitCost };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['partial-pieces'] });
      queryClient.invalidateQueries({ queryKey: ['partial-piece-items'] });
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
      // Stage 3: split master (catalog-owned) fields from per-company fields.
      // Master fields go through update_warehouse_catalog_item RPC; the AFTER
      // trigger fans them out to every company. Per-company fields are written
      // directly via PostgREST (column-level UPDATE grants enforce the split).
      const MASTER_FIELDS = [
        'name', 'description', 'category_id', 'unit_id', 'brand', 'manufacturer',
        'supplier_id', 'barcode', 'sku', 'image_url', 'is_serialized', 'is_batch_tracked'
      ] as const;

      const master: Record<string, any> = {};
      const perCompany: Record<string, any> = {};
      for (const [k, v] of Object.entries(itemData)) {
        if (k === 'item_code') continue; // immutable; catalog owns it
        if ((MASTER_FIELDS as readonly string[]).includes(k)) master[k] = v;
        else perCompany[k] = v;
      }

      // Master edits: resolve catalog_item_id from the inventory row, then RPC.
      if (Object.keys(master).length > 0) {
        const { data: row, error: rowErr } = await supabase
          .from('warehouse_items_full')
          .select('catalog_item_id')
          .eq('id', id)
          .single();
        if (rowErr) throw rowErr;
        const rpcArgs: Record<string, any> = { p_catalog_item_id: row.catalog_item_id };
        for (const f of MASTER_FIELDS) {
          if (f in master) rpcArgs[`p_${f}`] = master[f];
        }
        const { error: rpcErr } = await supabase.rpc('update_warehouse_catalog_item', rpcArgs as any);
        if (rpcErr) throw rpcErr;
      }

      // Per-company edits: direct update on warehouse_items
      let data: any = null;
      if (Object.keys(perCompany).length > 0) {
        const { data: updated, error } = await supabase
          .from('warehouse_items')
          .update(perCompany)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        data = updated;
      } else {
        const { data: refreshed } = await supabase
          .from('warehouse_items_full')
          .select()
          .eq('id', id)
          .single();
        data = refreshed;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['partial-pieces'] });
      queryClient.invalidateQueries({ queryKey: ['partial-piece-items'] });
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

      // Stage 1: resolve catalog_item_id for every row from warehouse_item_catalog.
      const codes = Array.from(new Set(itemsData.map(i => i.item_code).filter(Boolean)));
      const { data: catalogRows, error: catalogErr } = await supabase
        .from('warehouse_item_catalog')
        .select('id, item_code')
        .in('item_code', codes);
      if (catalogErr) throw catalogErr;
      const catalogByCode = new Map((catalogRows ?? []).map(r => [r.item_code, r.id]));
      const missing = codes.filter(c => !catalogByCode.has(c));
      if (missing.length) {
        throw new Error(`Catalog entries missing for ${missing.length} item codes (first: ${missing.slice(0, 5).join(', ')}). Create catalog rows first.`);
      }

      const itemsWithUser = itemsData.map(item => ({
        ...item,
        catalog_item_id: catalogByCode.get(item.item_code)!,
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
      queryClient.invalidateQueries({ queryKey: ['partial-pieces'] });
      queryClient.invalidateQueries({ queryKey: ['partial-piece-items'] });
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