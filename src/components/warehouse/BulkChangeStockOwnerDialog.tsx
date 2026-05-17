import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
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

  const [fromCompany, setFromCompany] = useState<string>(defaultFromCompanyId ?? '');
  const [toCompany, setToCompany] = useState<string>('');
  const [scope, setScope] = useState<'current_location' | 'all_locations'>(
    globalLocationId ? 'current_location' : 'all_locations'
  );
  const [busy, setBusy] = useState(false);

  const toOptions = useMemo(
    () => companies.filter((c) => c.id !== fromCompany),
    [companies, fromCompany]
  );

  const handleSubmit = async () => {
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
      _location_ids:
        scope === 'current_location' && globalLocationId ? [globalLocationId] : null,
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
      toast.warning('No allocations matched the source Stock Owner / scope');
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
            Reassigns ownership of physical stock (SAP EWM "Stock Owner") between companies. Bin
            and location stay the same; quantities are merged if the target owner already holds
            stock for the same item in the same bin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

          <div className="space-y-1.5">
            <Label>Location scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current_location" disabled={!globalLocationId}>
                  Current location only{!globalLocationId ? ' (no location selected)' : ''}
                </SelectItem>
                <SelectItem value="all_locations">All locations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Only allocations belonging to the source owner are moved. This action is restricted
              to administrators and cannot be undone in bulk.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !fromCompany || !toCompany}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer ownership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
