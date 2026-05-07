import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useCurrentUserLocationPermissions } from '@/hooks/useCurrentUserLocationPermissions';

export interface InventoryPageRow {
  id: string;
  item_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  unit_abbreviation: string | null;
  brand: string | null;
  manufacturer: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  status: string | null;
  current_stock: number | null;
  available_quantity: number | null;
  reserved_quantity: number | null;
  unit_cost: number | null;
  selling_price: number | null;
  reorder_level: number | null;
  min_stock_level: number | null;
  max_stock_level: number | null;
  image_url: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  bins: Array<{ id: string; bin_code: string; name: string; quantity: number }>;
}

interface Params {
  search?: string;
  categoryId?: string | null;
  status?: string | null;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Server-paginated inventory list backed by the `list_warehouse_inventory` RPC.
 * Use this on screens that browse the inventory table — never fetch all rows
 * client-side. See `mem://performance/warehouse-inventory-tab-optimization`.
 */
export function useWarehouseInventoryPage({
  search,
  categoryId,
  status,
  pageSize = 50,
  enabled = true,
}: Params = {}) {
  const { selectedCompany, isViewingAllCompanies } = useCompany();
  const { data: permissions } = useCurrentUserLocationPermissions();

  const companyId = isViewingAllCompanies ? null : selectedCompany?.id ?? null;

  const locationIds =
    permissions && !permissions.viewAllLocations
      ? Array.from(
          new Set([...permissions.viewLocationIds, ...permissions.editLocationIds])
        )
      : null;

  return useInfiniteQuery({
    queryKey: [
      'warehouse-inventory-page',
      companyId,
      isViewingAllCompanies,
      search ?? '',
      categoryId ?? null,
      status ?? null,
      locationIds,
      pageSize,
    ],
    enabled: enabled && (isViewingAllCompanies || !!selectedCompany?.id),
    initialPageParam: null as { created_at: string; id: string } | null,
    getNextPageParam: (last: InventoryPageRow[]) => {
      if (!last || last.length < pageSize) return undefined;
      const tail = last[last.length - 1];
      return { created_at: tail.created_at, id: tail.id };
    },
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('list_warehouse_inventory', {
        _company_id: companyId,
        _search: search ?? null,
        _category_id: categoryId ?? null,
        _status: status ?? null,
        _location_ids: locationIds,
        _cursor_created_at: pageParam?.created_at ?? null,
        _cursor_id: pageParam?.id ?? null,
        _limit: pageSize,
      });
      if (error) throw error;
      return (data ?? []) as InventoryPageRow[];
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
