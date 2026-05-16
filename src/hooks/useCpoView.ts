import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCpoView(cpoId: string) {
  // Main CPO data with all relationships
  const { data: cpo, isLoading: cpoLoading, error: cpoError } = useQuery({
    queryKey: ['customer-purchase-order', cpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_purchase_orders')
        .select(`
          *,
          customer:customers(*),
          items:customer_po_items(*),
          approvals:customer_po_approvals(
            *,
            approver:profiles(full_name, email)
          ),
          workflow:customer_po_workflow_tracking(*)
        `)
        .eq('id', cpoId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!cpoId,
  });

  // Warehouse reservations for this CPO
  const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ['cpo-reservations', cpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_item_reservations')
        .select(`
          *,
          warehouse_item:warehouse_items(
            id,
            current_stock,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
          ),
          bin_allocation:warehouse_bin_allocations(
            *,
            warehouse_bin:warehouse_bins(bin_code, name)
          )
        `)
        .eq('reference_id', cpoId)
        .eq('reference_type', 'cpo')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpoId,
  });

  // Material issue notes linked to this CPO
  const { data: materialIssues = [], isLoading: materialIssuesLoading } = useQuery({
    queryKey: ['cpo-material-issues', cpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_issue_notes')
        .select(`
          *,
          items:material_issue_items(
            *,
            warehouse_item:warehouse_items(
            id,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
          )
          ),
          issued_by_profile:profiles(full_name, email)
        `)
        .eq('cpo_id', cpoId)
        .order('issue_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpoId,
  });

  // Activity log from stock movements
  const { data: activityLog = [], isLoading: activityLoading } = useQuery({
    queryKey: ['cpo-activity-log', cpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_stock_movements')
        .select(`
          *,
          warehouse_item:warehouse_items(
            id,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
          ),
          performed_by_profile:profiles(full_name, email)
        `)
        .eq('reference_id', cpoId)
        .eq('reference_type', 'cpo')
        .order('movement_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpoId,
  });

  const isLoading = cpoLoading || reservationsLoading || materialIssuesLoading || activityLoading;

  return {
    cpo,
    reservations,
    materialIssues,
    activityLog,
    isLoading,
    error: cpoError,
  };
}
