import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface CategoryDistribution {
  categoryId: string | null;
  categoryName: string;
  itemCount: number;
  totalStock: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface TopItem {
  id: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  currentStock: number;
  unit: string;
}

export interface ItemMasterAnalytics {
  summary: {
    totalItems: number;
    totalStock: number;
    totalCategories: number;
    activeItems: number;
    inactiveItems: number;
  };
  byCategory: CategoryDistribution[];
  byStatus: StatusDistribution[];
  topItemsByStock: TopItem[];
}

export function useItemMasterAnalytics() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ['item-master-analytics', selectedCompany?.id],
    queryFn: async (): Promise<ItemMasterAnalytics> => {
      // Build query with company filter
      let query = supabase
        .from('warehouse_items_full')
        .select(`
          id,
          item_code,
          name,
          current_stock,
          status,
          category_id,
          item_categories (
            id,
            name
          )
        `)
        .order('current_stock', { ascending: false });

      // Filter by company if selected
      if (selectedCompany?.id) {
        query = query.eq('company_id', selectedCompany.id);
      }

      const { data: items, error } = await query;

      if (error) throw error;

      const itemList = items || [];

      // Calculate summary
      const totalItems = itemList.length;
      const activeItems = itemList.filter(item => item.status === 'active').length;
      const inactiveItems = itemList.filter(item => item.status !== 'active').length;
      const totalStock = itemList.reduce((sum, item) => sum + (item.current_stock || 0), 0);

      // Get unique categories
      const categorySet = new Set<string>();
      itemList.forEach(item => {
        if (item.category_id) categorySet.add(item.category_id);
      });
      const totalCategories = categorySet.size;

      // Group by category
      const categoryMap = new Map<string, CategoryDistribution>();
      itemList.forEach(item => {
        const categoryId = item.category_id || 'uncategorized';
        const categoryName = item.item_categories?.name || 'Uncategorized';
        
        if (!categoryMap.has(categoryId)) {
          categoryMap.set(categoryId, {
            categoryId: item.category_id,
            categoryName,
            itemCount: 0,
            totalStock: 0,
          });
        }
        
        const cat = categoryMap.get(categoryId)!;
        cat.itemCount += 1;
        cat.totalStock += item.current_stock || 0;
      });

      const byCategory = Array.from(categoryMap.values())
        .sort((a, b) => b.totalStock - a.totalStock)
        .slice(0, 10);

      // Group by status
      const statusMap = new Map<string, number>();
      itemList.forEach(item => {
        const status = item.status || 'unknown';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      });

      const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
      }));

      // Top items by stock
      const topItemsByStock: TopItem[] = itemList
        .slice(0, 10)
        .map(item => ({
          id: item.id,
          itemCode: item.item_code || '',
          itemName: item.name,
          categoryName: item.item_categories?.name || 'Uncategorized',
          currentStock: item.current_stock || 0,
          unit: 'pcs',
        }));

      return {
        summary: {
          totalItems,
          totalStock,
          totalCategories,
          activeItems,
          inactiveItems,
        },
        byCategory,
        byStatus,
        topItemsByStock,
      };
    },
  });
}
