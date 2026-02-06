import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export interface StockMovementReportFilters {
  startDate: string;
  endDate: string;
  transactionType?: string;
  categoryId?: string;
}

export interface StockMovementReportItem {
  id: string;
  created_at: string;
  transaction_type: string;
  reference_type: string;
  reference_id: string | null;
  item_code: string;
  item_name: string;
  category_name: string | null;
  brand: string | null;
  supplier_name: string | null;
  item_location_name: string | null;
  from_location_name: string | null;
  to_location_name: string | null;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number | null;
  total_value: number | null;
  issued_to_location_name: string | null;
  created_by_name: string | null;
  notes: string | null;
}

export const useStockMovementReport = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedCompany } = useCompany();

  const fetchReport = async (filters: StockMovementReportFilters): Promise<StockMovementReportItem[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query for stock transactions
      let query = supabase
        .from('stock_transactions')
        .select(`
          id,
          created_at,
          transaction_type,
          reference_type,
          reference_id,
          item_id,
          quantity_change,
          quantity_before,
          quantity_after,
          unit_cost,
          total_value,
          issued_to_location_id,
          created_by,
          notes
        `)
        .gte('created_at', `${filters.startDate}T00:00:00`)
        .lte('created_at', `${filters.endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      // Apply company filter if selected
      if (selectedCompany?.id) {
        query = query.eq('company_id', selectedCompany.id);
      }

      const { data: transactions, error: transError } = await query;
      if (transError) throw transError;
      if (!transactions || transactions.length === 0) return [];

      // Get unique item IDs
      const itemIds = [...new Set(transactions.map(t => t.item_id).filter(Boolean))];
      
      // Fetch warehouse items with categories
      const { data: items, error: itemsError } = await supabase
        .from('warehouse_items')
        .select(`
          id,
          item_code,
          name,
          brand,
          category_id,
          supplier_id,
          location_id,
          item_categories (
            id,
            name
          )
        `)
        .in('id', itemIds);
      
      if (itemsError) throw itemsError;

      // Get unique supplier IDs and fetch supplier names
      const supplierIds = [...new Set(
        items?.map(item => item.supplier_id).filter(Boolean)
      )] as string[];
      
      let suppliersMap = new Map<string, string>();
      if (supplierIds.length > 0) {
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id, name')
          .in('id', supplierIds);
        
        if (suppliers) {
          suppliersMap = new Map(suppliers.map(s => [s.id, s.name]));
        }
      }

      // Get unique item location IDs
      const itemLocationIds = [...new Set(
        items?.map(item => item.location_id).filter(Boolean)
      )] as string[];

      // Create items lookup map with supplier names and location_id
      const itemsMap = new Map(
        items?.map(item => [item.id, {
          item_code: item.item_code,
          item_name: item.name,
          brand: item.brand,
          category_id: item.category_id,
          category_name: item.item_categories?.name || null,
          supplier_name: item.supplier_id ? suppliersMap.get(item.supplier_id) || null : null,
          location_id: item.location_id
        }])
      );

      // Filter by category if specified
      let filteredTransactions = transactions;
      if (filters.categoryId) {
        const categoryItemIds = new Set(
          items?.filter(item => item.category_id === filters.categoryId).map(item => item.id)
        );
        filteredTransactions = transactions.filter(t => categoryItemIds.has(t.item_id));
      }

      // Filter by transaction type if specified
      if (filters.transactionType && filters.transactionType !== 'all') {
        filteredTransactions = filteredTransactions.filter(
          t => t.transaction_type === filters.transactionType
        );
      }

      // Get unique user IDs for created_by lookup
      const userIds = [...new Set(filteredTransactions.map(t => t.created_by).filter(Boolean))] as string[];
      
      let profilesMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_directory')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        if (profiles) {
          profilesMap = new Map(profiles.map(p => [p.user_id, p.full_name || 'Unknown']));
        }
      }

      // Get unique location IDs for issued_to_location lookup + item locations
      const locationIds = [...new Set([
        ...filteredTransactions.map(t => t.issued_to_location_id).filter(Boolean),
        ...itemLocationIds
      ])] as string[];
      
      let locationsMap = new Map<string, string>();
      if (locationIds.length > 0) {
        const { data: locations } = await supabase
          .from('warehouse_locations')
          .select('id, name')
          .in('id', locationIds);
        
        if (locations) {
          locationsMap = new Map(locations.map(l => [l.id, l.name]));
        }
      }

      // Get transfer request IDs for from/to location lookup
      const transferReferenceIds = [...new Set(
        filteredTransactions
          .filter(t => t.reference_type === 'transfer' && t.reference_id)
          .map(t => t.reference_id)
      )].filter(Boolean) as string[];

      // Fetch transfer requests with location details
      let transfersMap = new Map<string, { from_location: string | null; to_location: string | null }>();
      if (transferReferenceIds.length > 0) {
        const { data: transfers } = await supabase
          .from('stock_transfer_requests')
          .select(`
            id,
            from_location:warehouse_locations!stock_transfer_requests_from_location_id_fkey(name),
            from_sublocation:warehouse_locations!stock_transfer_requests_from_sublocation_id_fkey(name),
            to_location:warehouse_locations!stock_transfer_requests_to_location_id_fkey(name),
            to_sublocation:warehouse_locations!stock_transfer_requests_to_sublocation_id_fkey(name)
          `)
          .in('id', transferReferenceIds);

        if (transfers) {
          transfersMap = new Map(
            transfers.map(t => {
              const fromParts = [t.from_location?.name, t.from_sublocation?.name].filter(Boolean);
              const toParts = [t.to_location?.name, t.to_sublocation?.name].filter(Boolean);
              return [
                t.id,
                {
                  from_location: fromParts.length > 0 ? fromParts.join(' > ') : null,
                  to_location: toParts.length > 0 ? toParts.join(' > ') : null
                }
              ];
            })
          );
        }
      }

      // Map transactions to report items
      const reportItems: StockMovementReportItem[] = filteredTransactions.map(t => {
        const item = itemsMap.get(t.item_id);
        const transferInfo = t.reference_id ? transfersMap.get(t.reference_id) : null;
        
        return {
          id: t.id,
          created_at: t.created_at,
          transaction_type: t.transaction_type,
          reference_type: t.reference_type,
          reference_id: t.reference_id,
          item_code: item?.item_code || 'Unknown',
          item_name: item?.item_name || 'Unknown',
          category_name: item?.category_name || null,
          brand: item?.brand || null,
          supplier_name: item?.supplier_name || null,
          item_location_name: item?.location_id ? locationsMap.get(item.location_id) || null : null,
          from_location_name: transferInfo?.from_location || null,
          to_location_name: transferInfo?.to_location || null,
          quantity_change: t.quantity_change,
          quantity_before: t.quantity_before,
          quantity_after: t.quantity_after,
          unit_cost: t.unit_cost,
          total_value: t.total_value,
          issued_to_location_name: t.issued_to_location_id ? locationsMap.get(t.issued_to_location_id) || null : null,
          created_by_name: t.created_by ? profilesMap.get(t.created_by) || null : null,
          notes: t.notes
        };
      });

      return reportItems;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch report data';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fetchReport,
    isLoading,
    error
  };
};
