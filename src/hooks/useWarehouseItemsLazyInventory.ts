import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseItem } from '@/types/itemBin';
import { useCompany } from '@/contexts/CompanyContext';
import { useCurrentUserLocationPermissions } from '@/hooks/useCurrentUserLocationPermissions';

interface Cursor {
  created_at: string;
  id: string;
}

interface UseWarehouseItemsLazyInventoryOptions {
  pageSize?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
  locationId?: string | null;
}

const MAX_ITEMS = 20000;

/**
 * Infinite-scroll hook for Inventory tab: fetches warehouse items in 100-item batches
 * with bin allocation enrichment per batch. Caps at 20,000 items total.
 */
export function useWarehouseItemsLazyInventory({
  pageSize = 100,
  search,
  categoryId,
  status,
  supplierId,
  locationId,
}: UseWarehouseItemsLazyInventoryOptions) {
  const { selectedCompany, isViewingAllCompanies } = useCompany();
  const { data: permissions } = useCurrentUserLocationPermissions();

  return useInfiniteQuery({
    queryKey: [
      'warehouse-items-inventory',
      'lazy',
      selectedCompany?.id,
      isViewingAllCompanies,
      permissions?.viewAllLocations,
      locationId,
      search,
      categoryId,
      status,
      supplierId,
    ],
    queryFn: async ({ pageParam }: { pageParam: Cursor | null }) => {
      let query = supabase
        .from('warehouse_items')
        .select(`*, supplier:suppliers(id, name)`)
        .gt('current_stock', 0);

      // Company filter
      if (!isViewingAllCompanies && selectedCompany?.id) {
        query = query.eq('company_id', selectedCompany.id);
      }

      // Build search and cursor OR strings
      const searchOr = search?.trim()
        ? (() => {
            const escaped = search.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const term = `%${escaped}%`;
            return `name.ilike."${term}",item_code.ilike."${term}",brand.ilike."${term}",barcode.ilike."${term}",sku.ilike."${term}"`;
          })()
        : null;

      const cursorOr = pageParam
        ? `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`
        : null;

      if (categoryId && categoryId !== 'all') {
        query = query.eq('category_id', categoryId);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (supplierId && supplierId !== 'all') {
        query = query.eq('supplier_id', supplierId);
      }

      // Cursor-based keyset pagination
      query = query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      // Apply search and cursor as independent .or() calls (PostgREST ANDs them)
      if (searchOr) query = query.or(searchOr);
      if (cursorOr) query = query.or(cursorOr);

      query = query.limit(pageSize);

      const { data, error } = await query;
      if (error) throw error;

      const rawItems = (data || []) as any[];

      // Enrich with bin allocation data per batch
      const itemIds = rawItems.map((item) => item.id);
      let enrichedItems: WarehouseItem[] = rawItems.map((item) => ({
        ...item,
        bins: null,
      }));

      if (itemIds.length > 0) {
        // Fetch permitted bins
        let binsQuery = supabase
          .from('warehouse_bins')
          .select('id, bin_code, name, location_id');

        // If a specific location is selected, scope bins to that location
        if (locationId) {
          binsQuery = binsQuery.eq('location_id', locationId);
        } else if (permissions && !permissions.viewAllLocations) {
          const permittedLocationIds = [
            ...new Set([
              ...permissions.viewLocationIds,
              ...permissions.editLocationIds,
            ]),
          ];
          if (permittedLocationIds.length > 0) {
            binsQuery = binsQuery.in('location_id', permittedLocationIds);
          }
          // Fail-open: no explicit permissions = show all bins (no filter)
        }

        const { data: bins } = await binsQuery;
        const permittedBinIds = new Set(bins?.map((b) => b.id) || []);

        // Fetch allocations for this batch of items
        const { data: allocations } = await supabase
          .from('warehouse_bin_allocations')
          .select('warehouse_item_id, bin_id, available_quantity')
          .in('warehouse_item_id', itemIds)
          .gt('available_quantity', 0);

        if (allocations && bins) {
          const binLookup = new Map(bins.map((b) => [b.id, b]));
          const binsByItem: Record<
            string,
            Array<{ id: string; bin_code: string; name: string; quantity: number }>
          > = {};

          allocations.forEach((alloc: any) => {
            const itemId = alloc.warehouse_item_id;
            if (!permittedBinIds.has(alloc.bin_id)) return;

            const bin = binLookup.get(alloc.bin_id);
            if (!bin) return;

            if (!binsByItem[itemId]) binsByItem[itemId] = [];

            const existingBin = binsByItem[itemId].find((b) => b.id === bin.id);
            if (existingBin) {
              existingBin.quantity += Number(alloc.available_quantity);
            } else {
              binsByItem[itemId].push({
                id: bin.id,
                bin_code: bin.bin_code,
                name: bin.name,
                quantity: Number(alloc.available_quantity),
              });
            }
          });

          enrichedItems = rawItems.map((item) => ({
            ...item,
            bins: binsByItem[item.id] || null,
          }));
        }
      }

      let nextCursor: Cursor | null = null;
      if (enrichedItems.length === pageSize) {
        const last = enrichedItems[enrichedItems.length - 1];
        nextCursor = { created_at: last.created_at!, id: last.id };
      }

      return { items: enrichedItems, nextCursor };
    },
    initialPageParam: null as Cursor | null,
    getNextPageParam: (lastPage, allPages) => {
      // Cap at MAX_ITEMS
      const totalLoaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      if (totalLoaded >= MAX_ITEMS) return undefined;
      return lastPage.nextCursor;
    },
    enabled: !!(isViewingAllCompanies || selectedCompany?.id),
  });
}
