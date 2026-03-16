import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CatalogItem } from '@/types/itemBin';

interface Cursor {
  created_at: string;
  id: string;
}

interface UseWarehouseItemsLazyOptions {
  pageSize?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
}

function getSearchOrString(search?: string): string | null {
  if (!search?.trim()) return null;
  const term = `%${search.trim()}%`;
  return `name.ilike.${term},item_code.ilike.${term},brand.ilike.${term},barcode.ilike.${term},sku.ilike.${term}`;
}

function buildFilteredQuery(
  filters: { search?: string; categoryId?: string; status?: string; supplierId?: string },
  selectClause: string,
  countOption?: { count: 'exact' },
  applySearch = true
) {
  let query = countOption
    ? supabase.from('warehouse_item_catalog').select(selectClause, countOption)
    : supabase.from('warehouse_item_catalog').select(selectClause);

  if (applySearch) {
    const searchOr = getSearchOrString(filters.search);
    if (searchOr) {
      query = query.or(searchOr);
    }
  }
  if (filters.categoryId && filters.categoryId !== 'all') {
    query = query.eq('category_id', filters.categoryId);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.supplierId && filters.supplierId !== 'all') {
    query = query.eq('supplier_id', filters.supplierId);
  }
  return query;
}

/**
 * Infinite-scroll hook: fetches catalog items in batches using cursor-based (keyset) pagination.
 */
export function useWarehouseItemsLazy({
  pageSize = 100,
  search,
  categoryId,
  status,
  supplierId,
}: UseWarehouseItemsLazyOptions) {
  return useInfiniteQuery({
    queryKey: ['warehouse-item-catalog', 'lazy', search, categoryId, status, supplierId],
    queryFn: async ({ pageParam }: { pageParam: Cursor | null }) => {
      const filters = { search, categoryId, status, supplierId };
      const searchOr = getSearchOrString(search);
      const cursorOr = pageParam
        ? `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`
        : null;

      // Build query WITHOUT applying search .or() — we'll combine it with cursor
      let query = buildFilteredQuery(filters, `*, supplier:suppliers(id, name)`, undefined, false);

      query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

      // Apply search and cursor as a single filter to avoid double .or() issue
      if (searchOr && cursorOr) {
        query = query.or(searchOr).filter('or', `(${cursorOr})`, '');
      } else if (searchOr) {
        query = query.or(searchOr);
      } else if (cursorOr) {
        query = query.or(cursorOr);
      }

      query = query.limit(pageSize);

      const { data, error } = await query;
      if (error) throw error;

      const items = (data || []) as unknown as CatalogItem[];
      let nextCursor: Cursor | null = null;

      if (items.length === pageSize) {
        const last = items[items.length - 1];
        nextCursor = { created_at: last.created_at!, id: last.id };
      }

      return { items, nextCursor };
    },
    initialPageParam: null as Cursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * Fetch a total count for display purposes.
 */
export function useWarehouseItemsCount(filters: {
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
}) {
  return {
    queryKey: ['warehouse-item-catalog', 'count', filters.search, filters.categoryId, filters.status, filters.supplierId],
    queryFn: async () => {
      const query = buildFilteredQuery(filters, '*', { count: 'exact' });
      const { count, error } = await query.limit(0);
      if (error) throw error;
      return count ?? 0;
    },
  };
}

/**
 * Fetch ALL catalog items matching filters using cursor-based batching (for Excel export).
 */
export async function fetchAllWarehouseItemsBatched(filters: {
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
}): Promise<CatalogItem[]> {
  const batchSize = 1000;
  const allItems: CatalogItem[] = [];
  let cursor: Cursor | null = null;
  const seenIds = new Set<string>();

  while (true) {
    const searchOr = getSearchOrString(filters.search);
    const cursorOr = cursor
      ? `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      : null;

    let query = buildFilteredQuery(filters, `*, supplier:suppliers(id, name)`, undefined, false);
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

    if (searchOr && cursorOr) {
      query = query.or(searchOr).filter('or', `(${cursorOr})`, '');
    } else if (searchOr) {
      query = query.or(searchOr);
    } else if (cursorOr) {
      query = query.or(cursorOr);
    }

    query = query.limit(batchSize);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data || []) as unknown as CatalogItem[];
    for (const item of batch) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allItems.push(item);
      }
    }

    if (batch.length < batchSize) break;

    const last = batch[batch.length - 1];
    cursor = { created_at: last.created_at!, id: last.id };
  }

  return allItems;
}
