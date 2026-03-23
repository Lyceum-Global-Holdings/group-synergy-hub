import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { reconcileItem, reconcileItems, type ReconcileOverride, type ReconcileResult } from '@/utils/stockReconciliation';

export type StockAuditStatus = 'ok' | 'desync' | 'no_bins';

export interface StockAuditItem {
  id: string;
  item_code: string;
  name: string;
  current_stock: number;
  bin_total: number;
  bin_count: number;
  variance: number;
  status: StockAuditStatus;
}

export interface StockAuditLogEntry {
  id: string;
  recorded_at: string;
  recorded_by: string;
  total_items: number;
  in_sync_count: number;
  desync_count: number;
  no_bins_count: number;
  desynced_items: Array<{ id: string; item_code: string; name: string; current_stock: number; bin_total: number; variance: number }>;
  no_bins_items: Array<{ id: string; item_code: string; name: string; current_stock: number }>;
}

export function useStockAudit() {
  const queryClient = useQueryClient();
  const { selectedCompany, isViewingAllCompanies } = useCompany();

  const { data: auditItems = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stock-audit', selectedCompany?.id, isViewingAllCompanies],
    queryFn: async (): Promise<StockAuditItem[]> => {
      // Fetch active warehouse items with cursor-based batching
      const items: { id: string; item_code: string; name: string; current_stock: number }[] = [];
      let lastItemId: string | null = null;
      while (true) {
        let itemsQuery = supabase
          .from('warehouse_items')
          .select('id, item_code, name, current_stock')
          .eq('status', 'active')
          .order('id')
          .limit(1000);

        if (!isViewingAllCompanies && selectedCompany?.id) {
          itemsQuery = itemsQuery.eq('company_id', selectedCompany.id);
        }
        if (lastItemId) {
          itemsQuery = itemsQuery.gt('id', lastItemId);
        }

        const { data, error: itemsError } = await itemsQuery;
        if (itemsError) throw itemsError;
        if (!data || data.length === 0) break;
        items.push(...data);
        if (data.length < 1000) break;
        lastItemId = data[data.length - 1].id;
      }

      if (items.length === 0) return [];

      // Fetch bin allocations with cursor-based batching, filtered by company
      const allocations: { warehouse_item_id: string; allocated_quantity: number }[] = [];
      let lastAllocId: string | null = null;
      while (true) {
        let q = supabase
          .from('warehouse_bin_allocations')
          .select('id, warehouse_item_id, allocated_quantity')
          .order('id')
          .limit(1000);

        if (!isViewingAllCompanies && selectedCompany?.id) {
          q = q.eq('company_id', selectedCompany.id);
        }

        if (lastAllocId) q = q.gt('id', lastAllocId);

        const { data, error: allocError } = await q;
        if (allocError) throw allocError;
        if (!data || data.length === 0) break;
        allocations.push(...data);
        if (data.length < 1000) break;
        lastAllocId = data[data.length - 1].id;
      }

      // Group allocations by item id
      const allocationsByItem = new Map<string, number[]>();
      allocations.forEach((alloc) => {
        if (!allocationsByItem.has(alloc.warehouse_item_id)) {
          allocationsByItem.set(alloc.warehouse_item_id, []);
        }
        allocationsByItem.get(alloc.warehouse_item_id)!.push(alloc.allocated_quantity || 0);
      });

      // Compute audit result for each item
      return items.map((item) => {
        const binQtys = allocationsByItem.get(item.id) || [];
        const binTotal = binQtys.reduce((sum, q) => sum + q, 0);
        const binCount = binQtys.length;
        const currentStock = item.current_stock || 0;
        const variance = currentStock - binTotal;

        let status: StockAuditStatus;
        if (binCount === 0) {
          status = currentStock === 0 ? 'ok' : 'no_bins';
        } else {
          status = Math.abs(variance) < 0.001 ? 'ok' : 'desync';
        }

        return {
          id: item.id,
          item_code: item.item_code,
          name: item.name,
          current_stock: currentStock,
          bin_total: binTotal,
          bin_count: binCount,
          variance,
          status,
        };
      });
    },
    enabled: !!(isViewingAllCompanies || selectedCompany?.id),
  });

  // Fetch audit history (last 50 snapshots)
  const { data: auditHistory = [] } = useQuery({
    queryKey: ['stock-audit-history', selectedCompany?.id],
    queryFn: async (): Promise<StockAuditLogEntry[]> => {
      const { data, error } = await supabase
        .from('warehouse_stock_audit_logs')
        .select('id, recorded_at, recorded_by, total_items, in_sync_count, desync_count, no_bins_count, desynced_items, no_bins_items')
        .eq('company_id', selectedCompany!.id)
        .order('recorded_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as StockAuditLogEntry[];
    },
    enabled: !!selectedCompany?.id && !isViewingAllCompanies,
  });

  // Log a snapshot of the current audit state
  const logSnapshotMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedCompany?.id) return;
      if (auditItems.length === 0) return;

      const desynced = auditItems.filter((i) => i.status === 'desync');
      const noBins = auditItems.filter((i) => i.status === 'no_bins');

      const { error } = await supabase.from('warehouse_stock_audit_logs').insert({
        company_id: selectedCompany.id,
        recorded_by: user.id,
        total_items: summary.total,
        in_sync_count: summary.inSync,
        desync_count: summary.desynced,
        no_bins_count: summary.noBins,
        desynced_items: desynced.map((i) => ({
          id: i.id, item_code: i.item_code, name: i.name,
          current_stock: i.current_stock, bin_total: i.bin_total, variance: i.variance,
        })),
        no_bins_items: noBins.map((i) => ({
          id: i.id, item_code: i.item_code, name: i.name, current_stock: i.current_stock,
        })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-audit-history', selectedCompany?.id] });
    },
    onError: () => {},
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-audit'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
    queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
  };

  // Fix a single item using the shared engine
  const fixDesyncMutation = useMutation({
    mutationFn: async ({ item, override }: { item: StockAuditItem; override?: ReconcileOverride }) => {
      if (!selectedCompany?.id) throw new Error('No company selected');
      return reconcileItem(item, selectedCompany.id, override);
    },
    onSuccess: (result: ReconcileResult) => {
      invalidateAll();
      if (result.action === 'fixed' || result.action === 'created') {
        toast.success(`${result.itemCode}: ${result.message}`);
      } else if (result.action === 'blocked') {
        toast.warning(`${result.itemCode}: ${result.message}`);
      } else {
        toast.error(`${result.itemCode}: ${result.message}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Fix failed: ${error.message}`);
    },
  });

  // Fix all items using the shared engine
  const fixAllDesyncsMutation = useMutation({
    mutationFn: async (overrides?: Map<string, ReconcileOverride>) => {
      if (!selectedCompany?.id) throw new Error('No company selected');
      const itemsToFix = auditItems.filter((i) => i.status === 'desync' || i.status === 'no_bins');
      if (itemsToFix.length === 0) throw new Error('No items to fix.');
      return reconcileItems(itemsToFix, selectedCompany.id, overrides);
    },
    onSuccess: (result) => {
      invalidateAll();
      const msgs: string[] = [];
      if (result.fixed > 0) msgs.push(`${result.fixed} adjusted`);
      if (result.created > 0) msgs.push(`${result.created} allocations created`);
      if (msgs.length > 0) toast.success(msgs.join(', '));
      if (result.blocked > 0) toast.warning(`${result.blocked} item(s) blocked — missing location or bins`);
      if (result.failed > 0) toast.error(`${result.failed} item(s) failed`);
    },
    onError: (error: Error) => {
      toast.error(`Fix all failed: ${error.message}`);
    },
  });

  const summary = {
    total: auditItems.length,
    desynced: auditItems.filter((i) => i.status === 'desync').length,
    noBins: auditItems.filter((i) => i.status === 'no_bins').length,
    inSync: auditItems.filter((i) => i.status === 'ok').length,
  };

  return {
    auditItems,
    isLoading,
    error,
    refetch,
    summary,
    auditHistory,
    logSnapshot: logSnapshotMutation.mutate,
    fixDesync: (item: StockAuditItem, override?: ReconcileOverride) => fixDesyncMutation.mutate({ item, override }),
    isFixingDesync: fixDesyncMutation.isPending,
    fixAllDesyncs: (overrides?: Map<string, ReconcileOverride>) => fixAllDesyncsMutation.mutate(overrides),
    isFixingAll: fixAllDesyncsMutation.isPending,
  };
}
