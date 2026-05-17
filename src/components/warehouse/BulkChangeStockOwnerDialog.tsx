import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  onComplete: () => void;
  defaultFromOwner?: string | null;
}

export function BulkChangeStockOwnerDialog({
  open,
  onOpenChange,
  selectedIds,
  onComplete,
  defaultFromOwner = null,
}: Props) {
  const qc = useQueryClient();
  const { globalLocationId } = useLocationFilter();
  const { locations } = useWarehouseLocations();

  const [fromOwner, setFromOwner] = useState<string>(defaultFromOwner ?? '');
  const [toOwner, setToOwner] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Compute selected location + all descendants (sub-locations / departments).
  const { scopeIds, scopeLabel, descendantCount } = useMemo(() => {
    if (!globalLocationId) return { scopeIds: [] as string[], scopeLabel: '', descendantCount: 0 };
    const childrenOf = new Map<string, string[]>();
    for (const l of locations) {
      const p = l.parent_id ?? null;
      if (!p) continue;
      if (!childrenOf.has(p)) childrenOf.set(p, []);
      childrenOf.get(p)!.push(l.id);
    }
    const ids = new Set<string>([globalLocationId]);
    const queue = [globalLocationId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const child of childrenOf.get(cur) ?? []) {
        if (!ids.has(child)) { ids.add(child); queue.push(child); }
      }
    }
    const root = locations.find((l) => l.id === globalLocationId);
    const label = root ? (root.location_code ? `${root.name} (${root.location_code})` : root.name) : '';
    return { scopeIds: Array.from(ids), scopeLabel: label, descendantCount: ids.size - 1 };
  }, [globalLocationId, locations]);

  const trimmedTo = toOwner.trim();
  const trimmedFrom = fromOwner.trim();
  const canSubmit =
    !!globalLocationId &&
    trimmedTo.length > 0 &&
    trimmedFrom.toLowerCase() !== trimmedTo.toLowerCase() &&
    selectedIds.size > 0;

  const handleSubmit = async () => {
    if (!globalLocationId) {
      toast.error('Select a location in the header first');
      return;
    }
    if (!trimmedTo) {
      toast.error('Enter the new Stock Owner');
      return;
    }
    if (trimmedFrom.toLowerCase() === trimmedTo.toLowerCase()) {
      toast.error('Source and target Stock Owner must differ');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('No items selected');
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc('bulk_change_stock_owner' as any, {
      _item_ids: Array.from(selectedIds),
      _from_owner: trimmedFrom || null,
      _to_owner: trimmedTo,
      _location_ids: scopeIds,
    } as any);
    setBusy(false);

    if (error) {
      console.error(error);
      toast.error(error.message || 'Failed to change stock owner');
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const moved = Number(row?.moved_rows ?? 0);
    const merged = Number(row?.merged_rows ?? 0);
    const total = Number(row?.total_quantity ?? 0);

    if (moved + merged === 0) {
      toast.warning('No allocations matched the source Stock Owner in this location');
    } else {
      toast.success(
        `Transferred ${total} units across ${moved + merged} allocation row(s)` +
          (merged > 0 ? ` (${merged} merged into existing rows)` : '')
      );
    }

    qc.invalidateQueries({ queryKey: ['warehouse-items-inventory'] });
    qc.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
    qc.invalidateQueries({ queryKey: ['warehouse-items'] });

    onOpenChange(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Stock Owner — {selectedIds.size} item(s)</DialogTitle>
          <DialogDescription>
            Reassigns the Stock Owner label on physical stock within the currently selected
            location. Bin and location stay the same; quantities are merged if the target
            owner already holds stock for the same item in the same bin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!globalLocationId ? (
            <div className="flex gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Select a location in the header to change Stock Owner. System-wide changes are not
                allowed here.
              </span>
            </div>
          ) : (
            <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Scope: <strong className="text-foreground">{scopeLabel}</strong>
                {descendantCount > 0 ? ` (+${descendantCount} sub-location${descendantCount === 1 ? '' : 's'})` : ''}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>From (current owner)</Label>
            <Input
              value={fromOwner}
              onChange={(e) => setFromOwner(e.target.value)}
              placeholder="Leave blank to match unassigned stock"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Case-sensitive label match. Leave blank to move stock that currently has no owner.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>To (new owner)</Label>
            <Input
              value={toOwner}
              onChange={(e) => setToOwner(e.target.value)}
              placeholder="Type the new Stock Owner"
              maxLength={120}
            />
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Only allocations matching the source owner inside this location scope are moved.
              This action is restricted to administrators and cannot be undone in bulk.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !canSubmit}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer ownership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
