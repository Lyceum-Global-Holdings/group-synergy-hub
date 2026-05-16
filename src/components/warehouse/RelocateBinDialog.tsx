import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, MoveRight, PackageOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useToast } from '@/hooks/use-toast';
import { buildLocationOptions, getRootLocationId } from '@/lib/warehouse/locationHierarchy';
import type { WarehouseBin } from '@/types/itemBin';

type Mode = 'with_stock' | 'empty_only';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bin: WarehouseBin | null;
}

export function RelocateBinDialog({ open, onOpenChange, bin }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { locations, isLoading: loadingLocations } = useWarehouseLocations();
  const [mode, setMode] = useState<Mode>('with_stock');
  const [targetId, setTargetId] = useState<string>('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setMode('with_stock');
      setTargetId('');
      setReason('');
    }
  }, [open, bin?.id]);

  // Bin's current stock summary
  const { data: stockSummary, isLoading: loadingStock } = useQuery({
    enabled: !!bin?.id && open,
    queryKey: ['bin-stock-summary', bin?.id],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_bin_allocations')
        .select('allocated_quantity, warehouse_item_id')
        .eq('bin_id', bin!.id);
      if (error) throw error;
      const items = data ?? [];
      const totalQty = items.reduce((s, r: any) => s + Number(r.allocated_quantity || 0), 0);
      return { itemCount: items.length, totalQty };
    },
  });

  // Destination candidates: same company, not the current location
  const destinations = useMemo(() => {
    if (!bin) return [];
    const byId = new Map(locations.map((l) => [l.id, l] as const));
    return locations
      .filter((l) => l.company_id === bin.company_id && l.id !== bin.location_id)
      .map((l) => {
        const parent = l.parent_id ? byId.get(l.parent_id) : null;
        const label = parent ? `${parent.name} › ${l.name}` : l.name;
        return { id: l.id, label, isSub: !!l.parent_id };
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [locations, bin]);

  const currentName = useMemo(() => {
    if (!bin?.location_id) return '—';
    const byId = new Map(locations.map((l) => [l.id, l] as const));
    const cur = byId.get(bin.location_id);
    if (!cur) return '—';
    const parent = cur.parent_id ? byId.get(cur.parent_id) : null;
    return parent ? `${parent.name} › ${cur.name}` : cur.name;
  }, [bin, locations]);

  const blockedByStock = mode === 'empty_only' && (stockSummary?.totalQty ?? 0) > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bin) throw new Error('No bin');
      if (!targetId) throw new Error('Select a destination');
      const { data, error } = await (supabase as any).rpc('relocate_warehouse_bin', {
        _bin_id: bin.id,
        _new_location_id: targetId,
        _mode: mode,
        _reason: reason.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Bin relocated', description: `${bin?.bin_code} moved successfully.` });
      qc.invalidateQueries({ queryKey: ['warehouse-bins'] });
      qc.invalidateQueries({ queryKey: ['warehouse-network-hierarchy'] });
      qc.invalidateQueries({ queryKey: ['bin-allocations'] });
      qc.invalidateQueries({ queryKey: ['list-warehouse-inventory'] });
      qc.invalidateQueries({ queryKey: ['warehouse-items'] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: 'Relocation failed', description: e.message ?? String(e), variant: 'destructive' });
    },
  });

  if (!bin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveRight className="h-5 w-5 text-primary" />
            Relocate bin {bin.bin_code}
          </DialogTitle>
          <DialogDescription>
            Move this bin between a warehouse and a sub-location while keeping inventory consistent.
            Cross-company moves must go through Stock Transfer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/30 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground">Currently at</span>
              <Badge variant="secondary">{currentName}</Badge>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Destination</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <PackageOpen className="h-3 w-3" />
              {loadingStock ? 'Checking stock…' : (
                <>
                  {stockSummary?.itemCount ?? 0} allocation{(stockSummary?.itemCount ?? 0) === 1 ? '' : 's'} ·
                  {' '}{stockSummary?.totalQty ?? 0} units on hand
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid gap-2">
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="with_stock" className="mt-1" />
                <div className="text-sm">
                  <div className="font-medium">Move with current stock</div>
                  <div className="text-xs text-muted-foreground">
                    Bin and every allocation in it move to the new node. Quantities don't change; a
                    zero-quantity ledger entry per item records the move.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="empty_only" className="mt-1" />
                <div className="text-sm">
                  <div className="font-medium">Move empty bin only</div>
                  <div className="text-xs text-muted-foreground">
                    Fails if the bin still holds stock. Issue or transfer it out first.
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target">Destination *</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id="target">
                <SelectValue placeholder="Select warehouse or sub-location" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.isSub ? `↳ ${d.label}` : d.label}
                  </SelectItem>
                ))}
                {destinations.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No other locations in this company.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. floor reorganisation, bin assigned to a new zone…"
              rows={2}
            />
          </div>

          {blockedByStock && (
            <Alert variant="destructive">
              <AlertDescription>
                This bin still holds {stockSummary?.totalQty} units. Choose "Move with current stock" or
                empty the bin first.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!targetId || blockedByStock || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Relocate bin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
