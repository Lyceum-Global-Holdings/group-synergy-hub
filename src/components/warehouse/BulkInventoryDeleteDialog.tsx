import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { WarehouseItem } from '@/types/itemBin';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { usePurgeInactiveItem } from '@/hooks/warehouse/usePurgeInactiveItem';

interface BulkInventoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: WarehouseItem[];
  onComplete: () => void;
}

const MIN_INACTIVE_DAYS = 30;

function inactiveDays(item: WarehouseItem): number {
  const ts = item.updated_at ?? item.created_at;
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
}

export function BulkInventoryDeleteDialog({ open, onOpenChange, selectedItems, onComplete }: BulkInventoryDeleteDialogProps) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { canDelete: isAdminOrHigher } = useIsAdminOrHigher();
  const { purgeItemsBulk, isPurging } = usePurgeInactiveItem();
  const [isProcessing, setIsProcessing] = useState(false);
  const [purgeMode, setPurgeMode] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const buckets = useMemo(() => {
    const purgeable: WarehouseItem[] = [];
    const inactiveTooRecent: WarehouseItem[] = [];
    const withStock: WarehouseItem[] = [];
    const zeroStockActive: WarehouseItem[] = [];
    for (const i of selectedItems) {
      if ((i.current_stock || 0) > 0) {
        withStock.push(i);
      } else if (i.status === 'inactive') {
        if (inactiveDays(i) >= MIN_INACTIVE_DAYS) purgeable.push(i);
        else inactiveTooRecent.push(i);
      } else {
        zeroStockActive.push(i);
      }
    }
    return { purgeable, inactiveTooRecent, withStock, zeroStockActive };
  }, [selectedItems]);

  const handleArchive = async () => {
    setIsProcessing(true);
    let ok = 0;
    let fail = 0;
    for (const item of [...buckets.withStock, ...buckets.zeroStockActive]) {
      const { error } = await supabase
        .from('warehouse_items')
        .update({ status: 'inactive' })
        .eq('id', item.id);
      if (error) fail++;
      else ok++;
    }
    queryClient.invalidateQueries({ queryKey: ['warehouse-items-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-inventory-page'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-items-catalog-ids', selectedCompany?.id] });
    if (fail === 0) toast.success(`Marked ${ok} items inactive`);
    else toast.warning(`Marked ${ok} inactive, ${fail} failed`);
    setIsProcessing(false);
    onOpenChange(false);
    onComplete();
  };

  const handlePurge = async () => {
    if (!buckets.purgeable.length) return;
    await purgeItemsBulk({
      itemIds: buckets.purgeable.map((i) => i.id),
      reason: reason.trim(),
    });
    setReason('');
    setConfirmText('');
    setPurgeMode(false);
    onOpenChange(false);
    onComplete();
  };

  const purgeReady = confirmText.trim() === 'PERMANENTLY DELETE' && reason.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPurgeMode(false); setReason(''); setConfirmText(''); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {purgeMode ? `Permanently Delete ${buckets.purgeable.length} Items` : `Bulk Action — ${selectedItems.length} Items`}
          </DialogTitle>
        </DialogHeader>

        {purgeMode ? (
          <div className="space-y-3 py-2 text-sm">
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
              <ShieldAlert className="h-4 w-4 mt-0.5" />
              <div>
                <strong>{buckets.purgeable.length}</strong> Inactive item(s) eligible for permanent deletion. Snapshots are written to the security audit log. This cannot be undone.
              </div>
            </div>
            <div>
              <Label className="text-xs">Type <span className="font-mono">PERMANENTLY DELETE</span> to confirm</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Reason (required, ≥5 chars — logged)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Annual catalog cleanup …" />
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2 text-sm">
            {buckets.zeroStockActive.length > 0 && (
              <p>
                <strong>{buckets.zeroStockActive.length}</strong> active item(s) with zero stock will be{' '}
                <span className="text-warning font-medium">marked Inactive</span>.
              </p>
            )}
            {buckets.withStock.length > 0 && (
              <p>
                <strong>{buckets.withStock.length}</strong> item(s) with existing stock will be{' '}
                <span className="text-warning font-medium">marked Inactive</span> to preserve history.
              </p>
            )}
            {buckets.purgeable.length > 0 && (
              <p>
                <strong>{buckets.purgeable.length}</strong> Inactive item(s) (≥{MIN_INACTIVE_DAYS}d) are eligible for{' '}
                <span className="text-destructive font-medium">permanent deletion</span>.
              </p>
            )}
            {buckets.inactiveTooRecent.length > 0 && (
              <p className="text-muted-foreground">
                {buckets.inactiveTooRecent.length} Inactive item(s) cannot be purged yet (must be Inactive ≥{MIN_INACTIVE_DAYS} days).
              </p>
            )}
            {!isAdminOrHigher && buckets.purgeable.length > 0 && (
              <p className="text-xs text-muted-foreground">Admin role required for permanent deletion.</p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {purgeMode ? (
            <>
              <Button variant="destructive" onClick={handlePurge} disabled={!purgeReady || isPurging} className="w-full">
                {isPurging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Permanently Delete {buckets.purgeable.length}
              </Button>
              <Button variant="outline" onClick={() => setPurgeMode(false)} className="w-full">Back</Button>
            </>
          ) : (
            <>
              {(buckets.withStock.length > 0 || buckets.zeroStockActive.length > 0) && (
                <Button variant="default" onClick={handleArchive} disabled={isProcessing} className="w-full">
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mark {buckets.withStock.length + buckets.zeroStockActive.length} Inactive
                </Button>
              )}
              {buckets.purgeable.length > 0 && isAdminOrHigher && (
                <Button variant="destructive" onClick={() => setPurgeMode(true)} className="w-full">
                  Permanently Delete {buckets.purgeable.length}…
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
