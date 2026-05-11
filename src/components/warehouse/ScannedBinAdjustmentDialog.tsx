import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Reason codes map to GS1 CBV inventory bizSteps:
//   cycle_count / correction → cycle_counting / inventory_check
//   damage / loss            → corrective_action (disposition: damaged / destroyed)
//   found                    → inventory_check (disposition: in_progress)
//   transfer_in/out          → receiving / shipping
const REASONS: { value: string; label: string }[] = [
  { value: 'cycle_count',  label: 'Cycle count correction' },
  { value: 'correction',   label: 'Data entry correction' },
  { value: 'found',        label: 'Found / recovered stock' },
  { value: 'damage',       label: 'Damage / write-off' },
  { value: 'loss',         label: 'Loss / shrinkage' },
  { value: 'transfer_in',  label: 'Transfer in (received here)' },
  { value: 'transfer_out', label: 'Transfer out (left here)' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocationId: string;
  itemCode: string | null;
  itemName: string | null;
  binCode: string | null;
  locationName: string | null;
  allocatedQuantity: number;
  availableQuantity: number;
  onAdjusted: () => void;
}

export function ScannedBinAdjustmentDialog({
  open, onOpenChange, allocationId,
  itemCode, itemName, binCode, locationName,
  allocatedQuantity, availableQuantity, onAdjusted,
}: Props) {
  const { toast } = useToast();
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<string>('cycle_count');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setDirection('increase');
    setQty('');
    setReason('cycle_count');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(qty);
    if (!isFinite(n) || n <= 0) {
      toast({ title: 'Invalid quantity', description: 'Enter a positive number.', variant: 'destructive' });
      return;
    }
    const delta = direction === 'increase' ? n : -n;

    setSubmitting(true);
    const { data, error } = await (supabase as any).rpc('adjust_bin_allocation_from_scan', {
      p_allocation_id: allocationId,
      p_delta: delta,
      p_reason_code: reason,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      const msg = (() => {
        switch (error.message) {
          case 'permission_denied': return 'You do not have access to this company.';
          case 'insufficient_quantity': return 'Cannot decrease below zero.';
          case 'invalid_reason_code': return 'Pick a valid reason.';
          case 'invalid_delta': return 'Enter a non-zero quantity.';
          case 'allocation_not_found': return 'This bin allocation no longer exists.';
          case 'authentication_required': return 'Please sign in again.';
          default: return error.message || 'Failed to adjust stock.';
        }
      })();
      toast({ title: 'Adjustment failed', description: msg, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Stock adjusted',
      description: `New quantity: ${(data as any)?.new_quantity ?? '—'}`,
    });
    reset();
    onOpenChange(false);
    onAdjusted();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Scanned bin: {binCode ?? '—'} · {locationName ?? '—'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Item: </span><span className="font-mono">{itemCode}</span> — {itemName}</div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div><span className="text-muted-foreground">Allocated: </span>{allocatedQuantity}</div>
              <div><span className="text-muted-foreground">Available: </span>{availableQuantity}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v: 'increase' | 'decrease') => setDirection(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">Increase (+)</SelectItem>
                <SelectItem value="decrease">Decrease (−)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty">Quantity *</Label>
            <Input
              id="qty" type="number" step="0.01" min="0.01"
              value={qty} onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes" rows={3}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context for the audit log"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
