import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';

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
      // Fetch active warehouse items
      let itemsQuery = supabase
        .from('warehouse_items')
        .select('id, item_code, name, current_stock')
        .eq('status', 'active');

      if (!isViewingAllCompanies && selectedCompany?.id) {
        itemsQuery = itemsQuery.eq('company_id', selectedCompany.id);
      }

      const { data: items, error: itemsError } = await itemsQuery;
      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return [];

      // Fetch bin allocations in chunks of 100 to avoid URL length limits
      const itemIds = items.map((i) => i.id);
      const CHUNK_SIZE = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
        chunks.push(itemIds.slice(i, i + CHUNK_SIZE));
      }

      const chunkResults = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('warehouse_bin_allocations')
            .select('warehouse_item_id, allocated_quantity')
            .in('warehouse_item_id', chunk)
            .then((r) => {
              if (r.error) throw r.error;
              return r.data || [];
            })
        )
      );
      const allocations = chunkResults.flat();

      // Group allocations by item id
      const allocationsByItem = new Map<string, number[]>();
      (allocations || []).forEach((alloc) => {
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
      if (auditItems.length === 0) return; // don't log empty snapshots

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
          id: i.id,
          item_code: i.item_code,
          name: i.name,
          current_stock: i.current_stock,
          bin_total: i.bin_total,
          variance: i.variance,
        })),
        no_bins_items: noBins.map((i) => ({
          id: i.id,
          item_code: i.item_code,
          name: i.name,
          current_stock: i.current_stock,
        })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-audit-history', selectedCompany?.id] });
    },
    // Silently fail — logging is best-effort and shouldn't interrupt the user
    onError: () => {},
  });

  // Fix a single desynced item: adjust the largest bin allocation so SUM = current_stock
  const fixDesyncMutation = useMutation({
    mutationFn: async (item: StockAuditItem) => {
      if (item.bin_count === 0) {
        throw new Error('No bin allocations exist for this item. Create a bin allocation first.');
      }

      const { data: allocations, error: fetchError } = await supabase
        .from('warehouse_bin_allocations')
        .select('id, allocated_quantity, reserved_quantity')
        .eq('warehouse_item_id', item.id)
        .order('allocated_quantity', { ascending: false });

      if (fetchError) throw fetchError;
      if (!allocations || allocations.length === 0) {
        throw new Error('No bin allocations found.');
      }

      const otherTotal = allocations
        .slice(1)
        .reduce((sum, a) => sum + (a.allocated_quantity || 0), 0);

      const newPrimaryQty = Math.max(0, item.current_stock - otherTotal);
      const primaryAlloc = allocations[0];
      const newReserved = Math.min(primaryAlloc.reserved_quantity || 0, newPrimaryQty);

      const { error: updateError } = await supabase
        .from('warehouse_bin_allocations')
        .update({
          allocated_quantity: newPrimaryQty,
          reserved_quantity: newReserved,
          updated_at: new Date().toISOString(),
        })
        .eq('id', primaryAlloc.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-audit'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Desync fixed — bin allocation updated to match item master');
    },
    onError: (error: Error) => {
      toast.error(`Fix failed: ${error.message}`);
    },
  });

  // Fix all desynced items at once
  const fixAllDesyncsMutation = useMutation({
    mutationFn: async () => {
      const desynced = auditItems.filter((i) => i.status === 'desync');
      if (desynced.length === 0) throw new Error('No desynced items to fix.');

      let fixed = 0;
      let failed = 0;

      for (const item of desynced) {
        try {
          const { data: allocations, error: fetchError } = await supabase
            .from('warehouse_bin_allocations')
            .select('id, allocated_quantity, reserved_quantity')
            .eq('warehouse_item_id', item.id)
            .order('allocated_quantity', { ascending: false });

          if (fetchError || !allocations || allocations.length === 0) {
            failed++;
            continue;
          }

          const otherTotal = allocations
            .slice(1)
            .reduce((sum, a) => sum + (a.allocated_quantity || 0), 0);
          const newPrimaryQty = Math.max(0, item.current_stock - otherTotal);
          const primaryAlloc = allocations[0];
          const newReserved = Math.min(primaryAlloc.reserved_quantity || 0, newPrimaryQty);

          const { error: updateError } = await supabase
            .from('warehouse_bin_allocations')
            .update({
              allocated_quantity: newPrimaryQty,
              reserved_quantity: newReserved,
              available_quantity: Math.max(0, newPrimaryQty - newReserved),
              updated_at: new Date().toISOString(),
            })
            .eq('id', primaryAlloc.id);

          if (updateError) failed++;
          else fixed++;
        } catch {
          failed++;
        }
      }

      return { fixed, failed };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stock-audit'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      if (result.fixed > 0) toast.success(`Fixed ${result.fixed} desynced item(s)`);
      if (result.failed > 0) toast.warning(`${result.failed} item(s) could not be fixed`);
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
    fixDesync: fixDesyncMutation.mutate,
    isFixingDesync: fixDesyncMutation.isPending,
    fixAllDesyncs: fixAllDesyncsMutation.mutate,
    isFixingAll: fixAllDesyncsMutation.isPending,
  };
}
