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
    queryKey: ['construction-recent-transactions', limit],
    queryFn: async () => {
      // Fetch construction inventory transactions
      const { data: transactionsData, error } = await supabase
        .from('construction_inventory_transactions')
        .select(`
          id,
          item_id,
          transaction_type,
          quantity_change,
          notes,
          created_at,
          created_by,
          from_location_id,
          to_location_id
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Get unique item IDs
      const itemIds = [...new Set(transactionsData?.map(t => t.item_id).filter(Boolean))] as string[];
      
      // Get unique user IDs
      const userIds = [...new Set(transactionsData?.map(t => t.created_by).filter(Boolean))] as string[];
      
      // Get unique location IDs (both from and to)
      const fromLocationIds = transactionsData?.map(t => t.from_location_id).filter(Boolean) || [];
      const toLocationIds = transactionsData?.map(t => t.to_location_id).filter(Boolean) || [];
      const locationIds = [...new Set([...fromLocationIds, ...toLocationIds])] as string[];

      // Fetch item names from construction_inventory_master
      let itemsMap: Record<string, string> = {};
      if (itemIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('construction_inventory_master')
          .select('id, item_name')
          .in('id', itemIds);
        
        if (itemsData) {
          itemsMap = itemsData.reduce((acc, item) => {
            acc[item.id] = item.item_name;
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
        const fromLocation = t.from_location_id ? locationsMap[t.from_location_id] || null : null;
        const toLocation = t.to_location_id ? locationsMap[t.to_location_id] || null : null;

        return {
          id: t.id,
          transaction_type: t.transaction_type,
          quantity_change: Number(t.quantity_change) || 0,
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
