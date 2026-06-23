import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CatalogItem } from '@/types/itemBin';

export type CatalogSortBy = 'name' | 'item_code' | 'created_at';
export type CatalogSortDir = 'asc' | 'desc';

interface Cursor {
  created_at: string | null;
  item_code: string | null;
  name: string | null;
  id: string;
}

interface Filters {
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
}

interface UseWarehouseItemsLazyOptions extends Filters {
  pageSize?: number;
  sortBy?: CatalogSortBy;
  sortDir?: CatalogSortDir;
}

function rpcArgs(filters: Filters) {
  return {
    p_search: filters.search?.trim() ? filters.search.trim() : null,
    p_category_id: filters.categoryId && filters.categoryId !== 'all' ? filters.categoryId : null,
    p_status: filters.status && filters.status !== 'all' ? filters.status : null,
    p_supplier_id: filters.supplierId && filters.supplierId !== 'all' ? filters.supplierId : null,
  };
}

type CatalogPageRow = {
  id: string;
  item_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit_id: string | null;
  brand: string | null;
  barcode: string | null;
  sku: string | null;
  unit_cost: number | null;
  selling_price: number | null;
  reorder_level: number | null;
  status: string | null;
  image_url: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  created_at: string;
  last_purchase_price: number | null;
  last_purchase_date: string | null;
  last_purchase_supplier_name: string | null;
  last_purchase_grn_number: string | null;
};

function mapRow(row: CatalogPageRow): CatalogItem {
  const { supplier_id, supplier_name, ...rest } = row;
  return {
    ...rest,
    supplier_id,
    supplier: supplier_id ? { id: supplier_id, name: supplier_name ?? '' } : null,
  } as unknown as CatalogItem;
}


/**
 * Infinite-scroll hook with server-side sort. The keyset cursor advances on
 * (sort_key, id) in the same direction as the ORDER BY so pagination remains
 * strictly monotonic across name/item_code/created_at sorts.
 */
export function useWarehouseItemsLazy({
  pageSize = 50,
  search,
  categoryId,
  status,
  supplierId,
  sortBy = 'name',
  sortDir = 'asc',
}: UseWarehouseItemsLazyOptions) {
  return useInfiniteQuery({
    queryKey: ['warehouse-item-catalog', 'lazy', search, categoryId, status, supplierId, sortBy, sortDir],
    queryFn: async ({ pageParam }: { pageParam: Cursor | null }) => {
      const { data, error } = await supabase.rpc('get_warehouse_catalog_page' as any, {
        ...rpcArgs({ search, categoryId, status, supplierId }),
        p_cursor_created: pageParam?.created_at ?? null,
        p_cursor_code: pageParam?.item_code ?? null,
        p_cursor_id: pageParam?.id ?? null,
        p_limit: pageSize,
        p_sort_by: sortBy,
        p_sort_dir: sortDir,
        p_cursor_name: pageParam?.name ?? null,
      } as any);
      if (error) throw error;

      const rows = (data ?? []) as CatalogPageRow[];
      const items = rows.map(mapRow);
      let nextCursor: Cursor | null = null;
      if (rows.length === pageSize) {
        const last = rows[rows.length - 1];
        nextCursor = {
          created_at: last.created_at ?? null,
          item_code: last.item_code ?? null,
          name: last.name ?? null,
          id: last.id,
        };
      }
      return { items, nextCursor };
    },
    initialPageParam: null as Cursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Exact-count helper for the badge. Returns a query config consumed by useQuery.
 */
export function useWarehouseItemsCount(filters: Filters) {
  return {
    queryKey: ['warehouse-item-catalog', 'count', filters.search, filters.categoryId, filters.status, filters.supplierId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_warehouse_catalog_count', rpcArgs(filters));
      if (error) throw error;
      return Number(data ?? 0);
    },
  };
}

/**
 * Fetch ALL catalog items matching filters via the same keyset RPC (for Excel export).
 * Default sort name asc keeps the export deterministic.
 */
export async function fetchAllWarehouseItemsBatched(filters: Filters): Promise<CatalogItem[]> {
  const batchSize = 1000;
  const all: CatalogItem[] = [];
  const seen = new Set<string>();
  let cursor: Cursor | null = null;

  for (let i = 0; i < 500; i += 1) {
    const { data, error } = await supabase.rpc('get_warehouse_catalog_page' as any, {
      ...rpcArgs(filters),
      p_cursor_created: cursor?.created_at ?? null,
      p_cursor_code: cursor?.item_code ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: batchSize,
      p_sort_by: 'name',
      p_sort_dir: 'asc',
      p_cursor_name: cursor?.name ?? null,
    } as any);
    if (error) throw error;

    const rows = (data ?? []) as CatalogPageRow[];
    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        all.push(mapRow(row));
      }
    }

    if (rows.length < batchSize) break;
    const last = rows[rows.length - 1];
    cursor = {
      created_at: last.created_at ?? null,
      item_code: last.item_code ?? null,
      name: last.name ?? null,
      id: last.id,
    };
  }

  return all;
}
