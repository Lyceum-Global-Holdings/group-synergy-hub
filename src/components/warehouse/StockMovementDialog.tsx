import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { StockAdjustmentDialog } from './StockAdjustmentDialog';
import { Loader2, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  currentStock?: number;
  /** Physical storage location of this stock-keeping unit. */
  locationId?: string | null;
  locationName?: string | null;
  /** Specific bin scope. When provided, history filters to this bin only. */
  binId?: string | null;
  binCode?: string | null;
}

const transactionTypeLabels: Record<string, string> = {
  opening_stock: 'Opening Stock',
  goods_receipt: 'Goods Receipt',
  material_issue: 'Material Issue',
  material_return: 'Material Return',
  adjustment: 'Stock Adjustment',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  project_issue: 'Project Issue',
  project_return: 'Project Return',
};

const getTransactionTypeColor = (type: string) => {
  switch (type) {
    case 'opening_stock':
      return 'bg-blue-100 text-blue-800';
    case 'goods_receipt':
    case 'transfer_in':
    case 'project_return':
      return 'bg-green-100 text-green-800';
    case 'material_issue':
    case 'material_return':
    case 'transfer_out':
    case 'project_issue':
      return 'bg-red-100 text-red-800';
    case 'adjustment':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function StockMovementDialog({ open, onOpenChange, itemId, itemName, currentStock, locationId, locationName, binId, binCode }: StockMovementDialogProps) {
  // Bin options come from the actual allocations of this warehouse_item.
  // We deliberately do NOT filter by warehouse_bins.location_id here because
  // historical data can have bins allocated under a different recorded location.
  const { data: binOptions = [] } = useQuery({
    queryKey: ['stock-movement-bin-options', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_bin_allocations')
        .select('bin_id, warehouse_bins(id, bin_code, name, location_id)')
        .eq('warehouse_item_id', itemId);
      if (error) throw error;
      const seen = new Set<string>();
      const opts: { id: string; code: string; name: string; mismatched: boolean }[] = [];
      (data || []).forEach((row: any) => {
        const b = row.warehouse_bins;
        if (!b?.id || seen.has(b.id)) return;
        seen.add(b.id);
        opts.push({
          id: b.id,
          code: b.bin_code,
          name: b.name,
          mismatched: !!locationId && !!b.location_id && b.location_id !== locationId,
        });
      });
      return opts;
    },
    enabled: open && !!itemId,
  });

  // Default scope: explicit prop > user picked > "all bins" when multiple bins exist
  // (single-bin items still default to that bin via the picker hidden state).
  const [selectedBinId, setSelectedBinId] = useState<string | 'all' | undefined>(undefined);
  const effectiveBinId = useMemo<string | undefined>(() => {
    if (binId) return binId;
    if (selectedBinId === 'all') return undefined;
    if (selectedBinId) return selectedBinId;
    if (binOptions.length === 1) return binOptions[0].id;
    return undefined; // multiple bins → All bins by default with warning
  }, [binId, selectedBinId, binOptions]);

  const effectiveBinCode = useMemo(() => {
    if (binCode) return binCode;
    return binOptions.find((b) => b.id === effectiveBinId)?.code;
  }, [binCode, binOptions, effectiveBinId]);

  const { transactions, isLoading } = useStockTransactions(
    itemId,
    locationId ?? undefined,
    effectiveBinId ?? undefined,
  );
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);

  // Resolve bin codes for any transactions whose bin isn't in the current
  // allocations (e.g. legacy transfers from a bin no longer allocated).
  const txBinIds = useMemo(() => {
    const ids = new Set<string>();
    transactions.forEach((t: any) => { if (t.bin_id) ids.add(t.bin_id); });
    binOptions.forEach((b) => ids.delete(b.id));
    return Array.from(ids);
  }, [transactions, binOptions]);

  const { data: extraBinMap = {} } = useQuery({
    queryKey: ['stock-movement-extra-bin-codes', txBinIds.sort().join(',')],
    queryFn: async () => {
      if (txBinIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase
        .from('warehouse_bins')
        .select('id, bin_code')
        .in('id', txBinIds);
      const map: Record<string, string> = {};
      (data || []).forEach((b: any) => { map[b.id] = b.bin_code; });
      return map;
    },
    enabled: txBinIds.length > 0,
  });

  const binCodeFor = (id?: string | null) => {
    if (!id) return null;
    return binOptions.find((b) => b.id === id)?.code ?? extraBinMap[id] ?? null;
  };

  const showAllBinsWarning = !binId && binOptions.length > 1 && !effectiveBinId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 flex-wrap">
            <span>
              Stock Movement History — {itemName}
              {locationName && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  @ {locationName}
                </span>
              )}
              {effectiveBinCode && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  › Bin {effectiveBinCode}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {!binId && binOptions.length > 1 && (
                <Select
                  value={selectedBinId ?? 'all'}
                  onValueChange={(v) => setSelectedBinId(v as string)}
                >
                  <SelectTrigger className="h-8 w-[240px] text-xs">
                    <SelectValue placeholder="Filter by bin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All bins ({binOptions.length})</SelectItem>
                    {binOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.code} — {b.name}
                        {b.mismatched ? ' (cross-location)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={() => setIsAdjustmentDialogOpen(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Adjustment
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {showAllBinsWarning && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
            Showing movements across all {binOptions.length} bins for this item. Pick a specific bin above to isolate its history.
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading stock movements...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stock movements found for this item.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bin</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Qty Change</TableHead>
                  <TableHead className="text-right">Qty Before</TableHead>
                  <TableHead className="text-right">Qty After</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction: any) => {
                  const txBinCode = binCodeFor(transaction.bin_id);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getTransactionTypeColor(transaction.transaction_type)}
                        >
                          {transactionTypeLabels[transaction.transaction_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {txBinCode ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {transaction.reference_id || '-'}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        transaction.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.quantity_before}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {transaction.quantity_after}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.unit_cost ? `LKR ${transaction.unit_cost.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.total_value ? `LKR ${transaction.total_value.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {transaction.profiles?.full_name || transaction.profiles?.email || '-'}
                      </TableCell>
                      <TableCell>
                        {transaction.notes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <StockAdjustmentDialog
          open={isAdjustmentDialogOpen}
          onOpenChange={setIsAdjustmentDialogOpen}
          itemId={itemId}
          itemName={itemName}
          currentStock={currentStock || transactions[0]?.quantity_after || 0}
        />
      </DialogContent>
    </Dialog>
  );
}