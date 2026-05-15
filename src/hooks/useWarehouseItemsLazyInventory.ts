import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseItem } from '@/types/itemBin';
import { useCompany } from '@/contexts/CompanyContext';
import { useCurrentUserLocationPermissions } from '@/hooks/useCurrentUserLocationPermissions';

interface Cursor {
  created_at: string;
  id: string;
}

export type StockMode = 'all' | 'in_stock' | 'zero' | 'low';

interface UseWarehouseItemsLazyInventoryOptions {
  pageSize?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
  locationId?: string | null;
  stockMode?: StockMode;
}

const MAX_ITEMS = 20000;

/**
 * Infinite-scroll hook for Inventory tab.
 *
 * Two paths:
 *  1. When BOTH a company and a specific location are selected, route through the
 *     canonical RPC `get_company_inventory_at_location`. This guarantees per-company
 *     isolation at a physical node (incl. standalone sub-locations) and includes
 *     items whose presence at the location is expressed only via bin allocations.
 *     Inventory at one node is bounded — single page, capped at MAX_ITEMS.
 *  2. Otherwise (no location, or "All Companies" view), keep the existing cursor-
 *     based paginated query against `warehouse_items`.
 */
export function useWarehouseItemsLazyInventory({
  pageSize = 100,
  search,
  categoryId,
  status,
  supplierId,
  locationId,
  stockMode = 'all',
}: UseWarehouseItemsLazyInventoryOptions) {
  const { selectedCompany, isViewingAllCompanies } = useCompany();
  const { data: permissions } = useCurrentUserLocationPermissions();

  const useLocationScopedRpc =
    !!locationId && !!selectedCompany?.id && !isViewingAllCompanies;

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
      stockMode,
    ],
    queryFn: async ({ pageParam }: { pageParam: Cursor | null }) => {
      let rawItems: any[] = [];

      if (useLocationScopedRpc) {
        // Single-page canonical path. No cursor pagination — bounded set.
        if (pageParam !== null) {
          return { items: [] as WarehouseItem[], nextCursor: null as Cursor | null };
        }

        const { data, error } = await supabase.rpc(
          'get_company_inventory_at_location',
          {
            p_company_id: selectedCompany!.id,
            p_location_id: locationId!,
          }
        );
        if (error) throw error;

        let rows = (data || []) as any[];

        // Defensive cap
        if (rows.length > MAX_ITEMS) rows = rows.slice(0, MAX_ITEMS);

        // Hydrate supplier name (RPC returns plain warehouse_items rows)
        const supplierIds = [
          ...new Set(rows.map((r) => r.supplier_id).filter(Boolean)),
        ] as string[];
        let supplierMap = new Map<string, { id: string; name: string }>();
        if (supplierIds.length > 0) {
          const { data: suppliers } = await supabase
            .from('suppliers')
            .select('id, name')
            .in('id', supplierIds);
          supplierMap = new Map((suppliers || []).map((s) => [s.id, s]));
        }

        rawItems = rows.map((r) => ({
          ...r,
          supplier: r.supplier_id ? supplierMap.get(r.supplier_id) || null : null,
        }));

        // Apply remaining filters client-side over the bounded set
        if (search?.trim()) {
          const q = search.trim().toLowerCase();
          rawItems = rawItems.filter((it) => {
            const fields = [
              it.name,
              it.item_code,
              it.brand,
              it.barcode,
              it.sku,
            ];
            return fields.some(
              (f) => typeof f === 'string' && f.toLowerCase().includes(q)
            );
          });
        }
        if (categoryId && categoryId !== 'all') {
          rawItems = rawItems.filter((it) => it.category_id === categoryId);
        }
        if (status && status !== 'all') {
          rawItems = rawItems.filter((it) => it.status === status);
        }
        if (supplierId && supplierId !== 'all') {
          rawItems = rawItems.filter((it) => it.supplier_id === supplierId);
        }
        if (stockMode === 'in_stock') {
          rawItems = rawItems.filter((it) => Number(it.current_stock || 0) > 0);
        } else if (stockMode === 'zero') {
          rawItems = rawItems.filter((it) => Number(it.current_stock || 0) === 0);
        } else if (stockMode === 'low') {
          rawItems = rawItems.filter((it) => Number(it.current_stock || 0) <= Number(it.reorder_level || 0));
        }
      } else {
        // Item Master path (SAP MM03 semantics): list every master record
        // regardless of on-hand stock. Stock-based narrowing is an explicit
        // user choice via `stockMode` (MMBE-style filter), applied below.
        let query = supabase
          .from('warehouse_items')
          .select(`*, supplier:suppliers(id, name)`);

        if (!isViewingAllCompanies && selectedCompany?.id) {
          query = query.eq('company_id', selectedCompany.id);
        }

        if (stockMode === 'in_stock') query = query.gt('current_stock', 0);
        else if (stockMode === 'zero') query = query.eq('current_stock', 0);

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

        query = query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });

        if (searchOr) query = query.or(searchOr);
        if (cursorOr) query = query.or(cursorOr);

        query = query.limit(pageSize);

        const { data, error } = await query;
        if (error) throw error;
        rawItems = (data || []) as any[];
        if (stockMode === 'low') {
          rawItems = rawItems.filter((it) => Number(it.current_stock || 0) <= Number(it.reorder_level || 0));
        }
      }

      // Enrich with bin allocation data
      const itemIds = rawItems.map((item) => item.id);
      let enrichedItems: WarehouseItem[] = rawItems.map((item) => ({
        ...item,
        bins: null,
      }));

      if (itemIds.length > 0) {
        let binsQuery = supabase
          .from('warehouse_bins')
          .select('id, bin_code, name, location_id');

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
        }

        const { data: bins } = await binsQuery;
        const permittedBinIds = new Set(bins?.map((b) => b.id) || []);

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
      if (!useLocationScopedRpc && enrichedItems.length === pageSize) {
        const last = enrichedItems[enrichedItems.length - 1];
        nextCursor = { created_at: last.created_at!, id: last.id };
      }

      return { items: enrichedItems, nextCursor };
    },
    initialPageParam: null as Cursor | null,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      if (totalLoaded >= MAX_ITEMS) return undefined;
      return lastPage.nextCursor;
    },
    enabled: !!(isViewingAllCompanies || selectedCompany?.id),
  });
}
