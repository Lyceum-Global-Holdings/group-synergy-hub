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
  ownerCompanyId?: string | null;
}

const MAX_ITEMS = 20000;

/**
 * Infinite-scroll hook for Inventory tab.
 *
 * Canonical inventory path: `list_warehouse_inventory` derives stock from
 * warehouse_bin_allocations.location_id (physical node), while bins remain scoped
 * to the root warehouse. This keeps parent locations, sub-locations and shared
 * bin codes consistent with SAP EWM / Oracle WMS style stock visibility.
 */
export function useWarehouseItemsLazyInventory({
  pageSize = 100,
  search,
  categoryId,
  status,
  supplierId,
  locationId,
  stockMode = 'all',
  ownerCompanyId = null,
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
      permissions?.viewLocationIds,
      permissions?.editLocationIds,
      locationId,
      search,
      categoryId,
      status,
      supplierId,
      stockMode,
      ownerCompanyId,
    ],
    queryFn: async ({ pageParam }: { pageParam: Cursor | null }) => {
      const permittedLocationIds = permissions && !permissions.viewAllLocations
        ? [...new Set([...permissions.viewLocationIds, ...permissions.editLocationIds])]
        : [];
      const rpcLocationIds = locationId
        ? [locationId]
        : permittedLocationIds.length > 0
          ? permittedLocationIds
          : null;

      const { data, error } = await supabase.rpc('list_warehouse_inventory' as any, {
        _company_id: isViewingAllCompanies ? null : selectedCompany?.id ?? null,
        _search: search?.trim() || null,
        _category_id: categoryId && categoryId !== 'all' ? categoryId : null,
        _status: status && status !== 'all' ? status : null,
        _location_ids: rpcLocationIds,
        _cursor_created_at: pageParam?.created_at ?? null,
        _cursor_id: pageParam?.id ?? null,
        _limit: pageSize,
        _stock_mode: stockMode,
        _supplier_id: supplierId && supplierId !== 'all' ? supplierId : null,
        _owner_company_id: ownerCompanyId ?? null,
      } as any);
      if (error) throw error;

      const rows = ((data || []) as any[]).slice(0, MAX_ITEMS);
      const enrichedItems: WarehouseItem[] = rows.map((row) => ({
        ...row,
        supplier: row.supplier_id && row.supplier_name
          ? { id: row.supplier_id, name: row.supplier_name }
          : null,
        bins: Array.isArray(row.bins) && row.bins.length > 0 ? row.bins : null,
      }));

      let nextCursor: Cursor | null = null;
      if (enrichedItems.length === pageSize) {
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
