import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WarehouseCatalogRow {
  id: string;
  item_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  brand: string | null;
  manufacturer: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  barcode: string | null;
  sku: string | null;
  unit_cost: number | null;
  selling_price: number | null;
  reorder_level: number | null;
  min_stock_level: number | null;
  max_stock_level: number | null;
  image_url: string | null;
  is_serialized: boolean;
  is_batch_tracked: boolean;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_count: number;
}

interface UseCatalogPageOptions {
  search?: string;
  status?: string;
  categoryId?: string | null;
  supplierId?: string | null;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Stage 4: server-paginated reader for the global catalog (`warehouse_item_catalog`).
 * Backed by the `list_warehouse_catalog` RPC. Use this for any picker or list
 * that needs to browse the full catalog (15k+ rows) — never client-batch fetch.
 */
export function useWarehouseCatalogPage({
  search,
  status,
  categoryId,
  supplierId,
  pageSize = 50,
  enabled = true,
}: UseCatalogPageOptions = {}) {
  return useInfiniteQuery({
    queryKey: ['warehouse-catalog-page', { search, status, categoryId, supplierId, pageSize }],
    enabled,
    initialPageParam: { cursor_created_at: null as string | null, cursor_id: null as string | null },
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('list_warehouse_catalog' as any, {
        _search: search ?? null,
        _status: status ?? null,
        _category_id: categoryId ?? null,
        _supplier_id: supplierId ?? null,
        _cursor_created_at: pageParam.cursor_created_at,
        _cursor_id: pageParam.cursor_id,
        _limit: pageSize,
      });
      if (error) throw error;
      return (data ?? []) as WarehouseCatalogRow[];
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      const last = lastPage[lastPage.length - 1];
      return { cursor_created_at: last.created_at, cursor_id: last.id };
    },
    staleTime: 30_000,
  });
}
