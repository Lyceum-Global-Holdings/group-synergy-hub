import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardCheck } from 'lucide-react';
import { GRN_REJECTION_REASONS, GrnRejectionReason, GrnItem } from '@/types/grn';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: GrnItem | null;
  isLoading?: boolean;
  onConfirm: (input: {
    quantityAccepted: number;
    quantityRejected: number;
    reason?: GrnRejectionReason | null;
    notes?: string | null;
  }) => void | Promise<void>;
}

/**
 * Record how much of a received line is accepted vs rejected, with a reason code.
 * Only the accepted quantity is released to stock at approval (ISO 9001 §8.6);
 * the rejected quantity is segregated as quarantine stock (§8.7).
 */
export function InspectGrnItemDialog({ open, onOpenChange, item, isLoading, onConfirm }: Props) {
  const received = Number(item?.quantity_received ?? 0);
  const [rejected, setRejected] = useState(0);
  const [reason, setReason] = useState<GrnRejectionReason | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && item) {
      setRejected(Number(item.quantity_rejected ?? 0));
      setReason((item.rejection_reason as GrnRejectionReason) ?? '');
      setNotes(item.rejection_notes ?? '');
    }
  }, [open, item]);

  const accepted = useMemo(
    () => Math.max(0, received - (Number.isFinite(rejected) ? rejected : 0)),
    [received, rejected],
  );
  const unitPrice = Number(item?.net_unit_price ?? item?.unit_price ?? 0);
  const notesRequired = reason === 'other';
  const rejectingSome = rejected > 0;

  const outOfRange = rejected < 0 || rejected > received;
  const canSubmit =
    !!item &&
    !outOfRange &&
    (!rejectingSome || (!!reason && (!notesRequired || notes.trim().length > 0))) &&
    !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onConfirm({
      quantityAccepted: accepted,
      quantityRejected: rejected,
      reason: rejectingSome ? (reason as GrnRejectionReason) : null,
      notes: rejectingSome ? notes.trim() || null : null,
    });
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Inspect line
          </DialogTitle>
          <DialogDescription>
            {item.item_name} — {received} {item.unit_of_measure || ''} received. Reject only the
            non-conforming quantity; the rest is accepted into stock.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="grn-reject-qty">Reject quantity</Label>
              <Input
                id="grn-reject-qty"
                type="number"
                min={0}
                max={received}
                step="any"
                value={rejected}
                onChange={(e) => setRejected(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1">
              <Label>Accepted</Label>
              <div className="h-10 flex items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                {accepted} {item.unit_of_measure || ''}
              </div>
            </div>
          </div>

          {outOfRange && (
            <p className="text-xs text-destructive">
              Reject quantity must be between 0 and {received}.
            </p>
          )}

          {rejectingSome && (
            <>
              <div className="space-y-2">
                <Label htmlFor="grn-line-reason">
                  Rejection reason <span className="text-destructive">*</span>
                </Label>
                <Select value={reason} onValueChange={(v) => setReason(v as GrnRejectionReason)}>
                  <SelectTrigger id="grn-line-reason">
                    <SelectValue placeholder="Select a reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRN_REJECTION_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span>{r.label}</span>
                          {r.description && (
                            <span className="text-xs text-muted-foreground">{r.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grn-line-notes">
                  Notes {notesRequired && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="grn-line-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    notesRequired
                      ? 'Describe the non-conformance (required for “Other”).'
                      : 'Optional context for the supplier and audit trail.'
                  }
                />
              </div>
            </>
          )}

          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accepted value (billable)</span>
              <span className="font-medium">{(accepted * unitPrice).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rejected value (not payable)</span>
              <span>{(rejected * unitPrice).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isLoading ? 'Saving…' : 'Save inspection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
