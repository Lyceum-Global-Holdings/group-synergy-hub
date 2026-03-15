import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseItem } from '@/types/itemBin';

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

function buildFilteredQuery(
  filters: { search?: string; categoryId?: string; status?: string; supplierId?: string },
  selectClause: string,
  countOption?: { count: 'exact' }
) {
  let query = countOption
    ? supabase.from('warehouse_items').select(selectClause, countOption)
    : supabase.from('warehouse_items').select(selectClause);

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(
      `name.ilike.${term},item_code.ilike.${term},brand.ilike.${term},barcode.ilike.${term},sku.ilike.${term}`
    );
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
 * Infinite-scroll hook: fetches warehouse items in batches using cursor-based (keyset) pagination.
 * This reliably bypasses the 1,000-row Supabase/PostgREST per-request cap.
 */
export function useWarehouseItemsLazy({
  pageSize = 100,
  search,
  categoryId,
  status,
  supplierId,
}: UseWarehouseItemsLazyOptions) {
  return useInfiniteQuery({
    queryKey: ['warehouse-items', 'lazy', search, categoryId, status, supplierId],
    queryFn: async ({ pageParam }: { pageParam: Cursor | null }) => {
      const filters = { search, categoryId, status, supplierId };
      let query = buildFilteredQuery(filters, `*, supplier:suppliers(id, name)`);

      // Deterministic ordering: created_at DESC, id DESC
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

      // Cursor condition for keyset pagination
      if (pageParam) {
        // Items where (created_at < cursor) OR (created_at = cursor AND id < cursor_id)
        query = query.or(
          `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`
        );
      }

      query = query.limit(pageSize);

      const { data, error } = await query;
      if (error) throw error;

      const items = (data || []) as WarehouseItem[];
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
 * Fetch a total count for display purposes (separate lightweight query).
 */
export function useWarehouseItemsCount(filters: {
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
}) {
  // Use a regular select with head:true + count for a lightweight count-only query
  return {
    queryKey: ['warehouse-items', 'count', filters.search, filters.categoryId, filters.status, filters.supplierId],
    queryFn: async () => {
      const query = buildFilteredQuery(filters, '*', { count: 'exact' });
      const { count, error } = await query.limit(0);
      if (error) throw error;
      return count ?? 0;
    },
  };
}

/**
 * Fetch ALL items matching filters using cursor-based batching (for Excel export).
 */
export async function fetchAllWarehouseItemsBatched(filters: {
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
}): Promise<WarehouseItem[]> {
  const batchSize = 1000;
  const allItems: WarehouseItem[] = [];
  let cursor: Cursor | null = null;
  const seenIds = new Set<string>();

  while (true) {
    let query = buildFilteredQuery(filters, `*, supplier:suppliers(id, name)`);
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      );
    }

    query = query.limit(batchSize);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data || []) as WarehouseItem[];
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
