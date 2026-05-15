import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, ShieldAlert, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { WarehouseItem } from '@/types/itemBin';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { usePurgeInactiveItem, useCheckPurgeEligibility } from '@/hooks/warehouse/usePurgeInactiveItem';

interface BulkInventoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: WarehouseItem[];
  onComplete: () => void;
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

  const itemIds = useMemo(() => selectedItems.map((i) => i.id), [selectedItems]);
  const { data: eligibility = [], isLoading: isCheckingEligibility } =
    useCheckPurgeEligibility(itemIds, open);

  const buckets = useMemo(() => {
    const eligibleMap = new Map(eligibility.map((e) => [e.id, e]));
    const purgeable: WarehouseItem[] = [];
    const blocked: { item: WarehouseItem; reason: string }[] = [];
    for (const i of selectedItems) {
      const e = eligibleMap.get(i.id);
      if (e?.eligible) {
        purgeable.push(i);
      } else if (e) {
        const refs = e.blocking_refs ?? [];
        const reason =
          e.current_stock > 0
            ? `Stock: ${e.current_stock}`
            : refs.length
              ? refs.slice(0, 2).join(', ') + (refs.length > 2 ? '…' : '')
              : 'Has historical references';
        blocked.push({ item: i, reason });
      } else {
        // Eligibility row missing — treat as blocked (e.g. cross-company)
        blocked.push({ item: i, reason: 'Not accessible' });
      }
    }
    return { purgeable, blocked };
  }, [selectedItems, eligibility]);

  const handleArchive = async () => {
    if (!buckets.blocked.length) return;
    setIsProcessing(true);
    let ok = 0;
    let fail = 0;
    for (const { item } of buckets.blocked) {
      if (item.status === 'inactive') { ok++; continue; }
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
    if (fail === 0) toast.success(`Marked ${ok} item(s) Inactive`);
    else toast.warning(`Marked ${ok} Inactive, ${fail} failed`);
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
            {purgeMode ? `Permanently Delete ${buckets.purgeable.length} Item(s)` : `Bulk Action — ${selectedItems.length} Item(s)`}
          </DialogTitle>
          <DialogDescription>
            {purgeMode
              ? 'This action cannot be undone. A snapshot is written to the security audit log.'
              : 'Items with no stock and no historical references can be permanently deleted. Items with stock or references can only be archived (marked Inactive) to preserve history.'}
          </DialogDescription>
        </DialogHeader>

        {isCheckingEligibility ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking references…
          </div>
        ) : purgeMode ? (
          <div className="space-y-3 py-2 text-sm">
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
              <ShieldAlert className="h-4 w-4 mt-0.5" />
              <div>
                <strong>{buckets.purgeable.length}</strong> item(s) will be permanently deleted from the database. This cannot be undone.
              </div>
            </div>
            <div>
              <Label className="text-xs">Type <span className="font-mono">PERMANENTLY DELETE</span> to confirm</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="font-mono" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Reason (required, ≥5 chars — logged)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Annual catalog cleanup …" />
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2 text-sm">
            {buckets.purgeable.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <ShieldAlert className="h-4 w-4 mt-0.5 text-destructive" />
                <div>
                  <strong>{buckets.purgeable.length}</strong> item(s) eligible for{' '}
                  <span className="text-destructive font-medium">permanent deletion</span> — zero stock, zero references.
                </div>
              </div>
            )}
            {buckets.blocked.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
                <Archive className="h-4 w-4 mt-0.5 text-warning" />
                <div className="flex-1">
                  <div>
                    <strong>{buckets.blocked.length}</strong> item(s) cannot be deleted (have stock or history) — can be{' '}
                    <span className="text-warning font-medium">marked Inactive</span> to preserve audit trail.
                  </div>
                  <ul className="mt-2 max-h-24 overflow-auto text-xs text-muted-foreground space-y-0.5">
                    {buckets.blocked.slice(0, 5).map(({ item, reason }) => (
                      <li key={item.id}><span className="font-mono">{item.item_code}</span> — {reason}</li>
                    ))}
                    {buckets.blocked.length > 5 && <li>…and {buckets.blocked.length - 5} more</li>}
                  </ul>
                </div>
              </div>
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
              {buckets.purgeable.length > 0 && isAdminOrHigher && (
                <Button variant="destructive" onClick={() => setPurgeMode(true)} className="w-full">
                  Permanently Delete {buckets.purgeable.length}…
                </Button>
              )}
              {buckets.blocked.length > 0 && (
                <Button variant="default" onClick={handleArchive} disabled={isProcessing} className="w-full">
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mark {buckets.blocked.length} Inactive
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
