import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseItem } from '@/types/itemBin';

interface UseWarehouseItemsPagedOptions {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
}

export function useWarehouseItemsPaged({
  page,
  pageSize,
  search,
  categoryId,
  status,
  supplierId,
}: UseWarehouseItemsPagedOptions) {
  return useQuery({
    queryKey: [
      'warehouse-items',
      'paged',
      page,
      pageSize,
      search,
      categoryId,
      status,
      supplierId,
    ],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_items')
        .select(
          `*, supplier:suppliers(id, name)`,
          { count: 'exact' }
        );

      // Server-side filters
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(
          `name.ilike.${term},item_code.ilike.${term},brand.ilike.${term},barcode.ilike.${term},sku.ilike.${term}`
        );
      }

      if (categoryId && categoryId !== 'all') {
        query = query.eq('category_id', categoryId);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (supplierId && supplierId !== 'all') {
        query = query.eq('supplier_id', supplierId);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        items: (data || []) as WarehouseItem[],
        totalCount: count ?? 0,
      };
    },
  });
}

/**
 * Fetch ALL items matching filters in batches of 1000 (for Excel export).
 */
export async function fetchAllWarehouseItemsBatched(filters: {
  search?: string;
  categoryId?: string;
  status?: string;
  supplierId?: string;
}): Promise<WarehouseItem[]> {
  const batchSize = 1000;
  let allItems: WarehouseItem[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('warehouse_items')
      .select(`*, supplier:suppliers(id, name)`);

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

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) throw error;

    allItems = allItems.concat((data || []) as WarehouseItem[]);
    if (!data || data.length < batchSize) {
      hasMore = false;
    } else {
      from += batchSize;
    }
  }

  return allItems;
}
