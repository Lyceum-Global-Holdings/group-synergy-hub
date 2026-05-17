import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  onComplete: () => void;
  defaultFromCompanyId?: string | null;
}

export function BulkChangeStockOwnerDialog({
  open,
  onOpenChange,
  selectedIds,
  onComplete,
  defaultFromCompanyId = null,
}: Props) {
  const qc = useQueryClient();
  const { companies } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { locations } = useWarehouseLocations();

  const [fromCompany, setFromCompany] = useState<string>(defaultFromCompanyId ?? '');
  const [toCompany, setToCompany] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const toOptions = useMemo(
    () => companies.filter((c) => c.id !== fromCompany),
    [companies, fromCompany]
  );

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

  const canSubmit = !!globalLocationId && !!fromCompany && !!toCompany && fromCompany !== toCompany && selectedIds.size > 0;

  const handleSubmit = async () => {
    if (!globalLocationId) {
      toast.error('Select a location in the header first');
      return;
    }
    if (!fromCompany || !toCompany) {
      toast.error('Select both source and target Stock Owner');
      return;
    }
    if (fromCompany === toCompany) {
      toast.error('Source and target must differ');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('No items selected');
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc('bulk_change_stock_owner' as any, {
      _item_ids: Array.from(selectedIds),
      _from_company: fromCompany,
      _to_company: toCompany,
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
            Reassigns ownership of physical stock (SAP EWM "Stock Owner") between companies within
            the currently selected location. Bin and location stay the same; quantities are merged
            if the target owner already holds stock for the same item in the same bin.
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
            <Select value={fromCompany} onValueChange={setFromCompany}>
              <SelectTrigger><SelectValue placeholder="Select source owner" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>To (new owner)</Label>
            <Select value={toCompany} onValueChange={setToCompany}>
              <SelectTrigger><SelectValue placeholder="Select target owner" /></SelectTrigger>
              <SelectContent>
                {toOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Only allocations belonging to the source owner inside this location scope are moved.
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
