import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecentTransaction {
  id: string;
  transaction_type: string;
  quantity_change: number;
  notes: string | null;
  created_at: string;
  item_name: string | null;
  item_id: string;
  from_location: string | null;
  to_location: string | null;
  performed_by: string | null;
}

export function useRecentTransactions(limit: number = 10) {
  return useQuery({
    queryKey: ['recent-transactions', limit],
    queryFn: async () => {
      // Fetch stock transactions with item details
      const { data: transactionsData, error } = await supabase
        .from('stock_transactions')
        .select(`
          id,
          item_id,
          transaction_type,
          quantity_change,
          notes,
          created_at,
          created_by,
          issued_to_location_id
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Get unique item IDs
      const itemIds = [...new Set(transactionsData?.map(t => t.item_id).filter(Boolean))] as string[];
      
      // Get unique user IDs
      const userIds = [...new Set(transactionsData?.map(t => t.created_by).filter(Boolean))] as string[];
      
      // Get unique location IDs
      const locationIds = [...new Set(transactionsData?.map(t => t.issued_to_location_id).filter(Boolean))] as string[];

      // Fetch item names from warehouse_items
      let itemsMap: Record<string, string> = {};
      if (itemIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('warehouse_items')
          .select('id, name')
          .in('id', itemIds);
        
        if (itemsData) {
          itemsMap = itemsData.reduce((acc, item) => {
            acc[item.id] = item.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Fetch user profiles
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.user_id] = profile.full_name || profile.email || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Fetch location names
      let locationsMap: Record<string, string> = {};
      if (locationIds.length > 0) {
        const { data: locationsData } = await supabase
          .from('warehouse_locations')
          .select('id, name')
          .in('id', locationIds);
        
        if (locationsData) {
          locationsMap = locationsData.reduce((acc, loc) => {
            acc[loc.id] = loc.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Map transactions with enriched data
      const enrichedTransactions: RecentTransaction[] = (transactionsData || []).map(t => {
        let fromLocation: string | null = null;
        let toLocation: string | null = null;

        // Determine from/to locations based on transaction type
        if (t.transaction_type === 'transfer_out') {
          fromLocation = 'Main Warehouse';
          toLocation = t.issued_to_location_id ? locationsMap[t.issued_to_location_id] || null : null;
        } else if (t.transaction_type === 'transfer_in') {
          fromLocation = t.issued_to_location_id ? locationsMap[t.issued_to_location_id] || null : null;
          toLocation = 'Main Warehouse';
        } else if (t.transaction_type === 'project_issue' || t.transaction_type === 'material_issue') {
          fromLocation = 'Main Warehouse';
          toLocation = t.issued_to_location_id ? locationsMap[t.issued_to_location_id] || 'Project' : 'Project';
        } else if (t.transaction_type === 'project_return' || t.transaction_type === 'material_return') {
          fromLocation = t.issued_to_location_id ? locationsMap[t.issued_to_location_id] || 'Project' : 'Project';
          toLocation = 'Main Warehouse';
        } else if (t.transaction_type === 'goods_receipt') {
          fromLocation = 'Supplier';
          toLocation = 'Main Warehouse';
        }

        return {
          id: t.id,
          transaction_type: t.transaction_type,
          quantity_change: t.quantity_change,
          notes: t.notes,
          created_at: t.created_at,
          item_id: t.item_id,
          item_name: t.item_id ? itemsMap[t.item_id] || null : null,
          from_location: fromLocation,
          to_location: toLocation,
          performed_by: t.created_by ? profilesMap[t.created_by] || null : null,
        };
      });

      return enrichedTransactions;
    }
  });
}
