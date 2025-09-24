import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ItemReference {
  table: string;
  description: string;
  count: number;
}

export const useItemReferences = (itemId: string) => {
  return useQuery({
    queryKey: ['item-references', itemId],
    queryFn: async (): Promise<ItemReference[]> => {
      if (!itemId) return [];

      const references: ItemReference[] = [];

      // Check PR items
      const { count: prItemsCount } = await supabase
        .from('pr_items')
        .select('*', { count: 'exact', head: true })
        .eq('warehouse_item_id', itemId);

      if (prItemsCount && prItemsCount > 0) {
        references.push({
          table: 'pr_items',
          description: 'Purchase Requisition Items',
          count: prItemsCount
        });
      }

      // Check PO items
      const { count: poItemsCount } = await supabase
        .from('po_items')
        .select('*', { count: 'exact', head: true })
        .eq('warehouse_item_id', itemId);

      if (poItemsCount && poItemsCount > 0) {
        references.push({
          table: 'po_items',
          description: 'Purchase Order Items',
          count: poItemsCount
        });
      }

      // Check BOM items
      const { count: bomItemsCount } = await supabase
        .from('bom_items')
        .select('*', { count: 'exact', head: true })
        .eq('warehouse_item_id', itemId);

      if (bomItemsCount && bomItemsCount > 0) {
        references.push({
          table: 'bom_items',
          description: 'Bill of Materials Items',
          count: bomItemsCount
        });
      }

      // Check Bill of Materials (main table)
      const { count: bomCount } = await supabase
        .from('bill_of_materials')
        .select('*', { count: 'exact', head: true })
        .eq('warehouse_item_id', itemId);

      if (bomCount && bomCount > 0) {
        references.push({
          table: 'bill_of_materials',
          description: 'Bill of Materials',
          count: bomCount
        });
      }

      // Check Material Issue items
      const { count: materialIssueCount } = await supabase
        .from('material_issue_items')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', itemId);

      if (materialIssueCount && materialIssueCount > 0) {
        references.push({
          table: 'material_issue_items',
          description: 'Material Issue Items',
          count: materialIssueCount
        });
      }

      // Check Material Return items
      const { count: materialReturnCount } = await supabase
        .from('material_return_items')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', itemId);

      if (materialReturnCount && materialReturnCount > 0) {
        references.push({
          table: 'material_return_items',
          description: 'Material Return Items',
          count: materialReturnCount
        });
      }

      // Check Stock Transactions
      const { count: stockTransactionsCount } = await supabase
        .from('stock_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', itemId);

      if (stockTransactionsCount && stockTransactionsCount > 0) {
        references.push({
          table: 'stock_transactions',
          description: 'Stock Transactions',
          count: stockTransactionsCount
        });
      }

      // Check GRN items
      const { count: grnItemsCount } = await supabase
        .from('grn_items')
        .select('*', { count: 'exact', head: true })
        .eq('warehouse_item_id', itemId);

      if (grnItemsCount && grnItemsCount > 0) {
        references.push({
          table: 'grn_items',
          description: 'Goods Receipt Note Items',
          count: grnItemsCount
        });
      }

      return references;
    },
    enabled: !!itemId
  });
};