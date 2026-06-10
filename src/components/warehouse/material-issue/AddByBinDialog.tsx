import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Boxes } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBinsAtLocation } from '@/hooks/warehouse/useBinsAtLocation';
import type { BrowsePickedRow } from '../BrowseInventoryDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  locationId: string | null;
  existingItemIds: string[];
  onResolved: (rows: BrowsePickedRow[]) => void;
}

interface BinAllocRow {
  item_id: string;
  item_code: string;
  name: string;
  unit_of_measure: string | null;
  bin_code: string | null;
  bin_qty: number;
  current_stock: number;
}

export function AddByBinDialog({
  open,
  onOpenChange,
  companyId,
  locationId,
  existingItemIds,
  onResolved,
}: Props) {
  const [binId, setBinId] = useState<string>('');

  useEffect(() => {
    if (!open) setBinId('');
  }, [open]);

  const { data: bins = [], isLoading: binsLoading } = useBinsAtLocation(locationId);

  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ['min-add-by-bin', binId, companyId],
    enabled: !!binId && !!companyId && open,
    staleTime: 0,
    queryFn: async (): Promise<BinAllocRow[]> => {
      let q = supabase
        .from('warehouse_bin_allocations')
        .select(`
          allocated_quantity,
          available_quantity,
          warehouse_item:warehouse_items!warehouse_bin_allocations_warehouse_item_id_fkey(
            id,
            current_stock,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(
              item_code,
              name,
              unit_of_measure
            )
          ),
          warehouse_bin:warehouse_bins!warehouse_bin_allocations_bin_id_fkey(bin_code)
        `)
        .eq('bin_id', binId)
        .gt('available_quantity', 0);
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => {
          const item = r.warehouse_item;
          if (!item?.id) return null;
          return {
            item_id: item.id,
            item_code: item.catalog?.item_code ?? '',
            name: item.catalog?.name ?? '',
            unit_of_measure: item.catalog?.unit_of_measure ?? null,
            bin_code: r.warehouse_bin?.bin_code ?? null,
            bin_qty: Number(r.available_quantity ?? r.allocated_quantity ?? 0),
            current_stock: Number(item.current_stock || 0),
          } as BinAllocRow;
        })
        .filter(Boolean) as BinAllocRow[];
    },
  });

  const existing = useMemo(() => new Set(existingItemIds), [existingItemIds]);
  const eligible = useMemo(() => rows.filter((r) => !existing.has(r.item_id)), [rows, existing]);

  const handleConfirm = () => {
    const picked: BrowsePickedRow[] = eligible.map((r) => ({
      id: r.item_id,
      item_code: r.item_code,
      name: r.name,
      description: null,
      unit_of_measure: r.unit_of_measure,
      current_stock: r.current_stock,
      bin_code: r.bin_code,
      quantity: r.bin_qty,
    }));
    onResolved(picked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" /> Add items by bin
          </DialogTitle>
          <DialogDescription>
            Pick a bin at the issue location. Every item currently allocated to it
            will be staged with its full bin quantity — you can still tweak each
            row before adding to the MIN.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Bin</label>
            <Select value={binId} onValueChange={setBinId} disabled={binsLoading || !locationId}>
              <SelectTrigger>
                <SelectValue placeholder={binsLoading ? 'Loading bins…' : 'Select a bin'} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {bins.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bin_code}
                    {b.name ? ` — ${b.name}` : ''}
                  </SelectItem>
                ))}
                {bins.length === 0 && !binsLoading && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No bins at this location.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {binId && (
            <div className="border rounded-md overflow-hidden">
              {rowsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading allocations…
                </div>
              ) : rows.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No stock in this bin.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>UoM</TableHead>
                      <TableHead className="text-right">Bin qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const already = existing.has(r.item_id);
                      return (
                        <TableRow
                          key={r.item_id}
                          className={already ? 'opacity-50' : ''}
                        >
                          <TableCell className="flex items-center gap-2">
                            <span className="truncate max-w-[260px]">{r.name}</span>
                            {already && (
                              <Badge variant="secondary" className="text-[10px]">
                                already added
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{r.item_code}</Badge>
                          </TableCell>
                          <TableCell>{r.unit_of_measure || '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.bin_qty}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={eligible.length === 0}>
            Add {eligible.length || ''} item{eligible.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
