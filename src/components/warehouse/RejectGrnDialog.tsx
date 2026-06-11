import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import {
  GRN_REJECTION_REASONS,
  GrnRejectionReason,
} from '@/types/grn';

interface RejectGrnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grnNumber: string;
  isLoading?: boolean;
  onConfirm: (reason: GrnRejectionReason, notes?: string) => void | Promise<void>;
}

export function RejectGrnDialog({
  open,
  onOpenChange,
  grnNumber,
  isLoading,
  onConfirm,
}: RejectGrnDialogProps) {
  const [reason, setReason] = useState<GrnRejectionReason | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setNotes('');
    }
  }, [open]);

  const notesRequired = reason === 'other';
  const canSubmit =
    !!reason && (!notesRequired || notes.trim().length > 0) && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit || !reason) return;
    await onConfirm(reason, notes.trim() || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Reject GRN {grnNumber}
          </DialogTitle>
          <DialogDescription>
            Choose a standardised reason (ISO 9001 §8.7 / GS1 CBV / SAP MIGO). Rejection is
            permanent and prevents any stock from being received.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grn-reject-reason">Rejection reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as GrnRejectionReason)}>
              <SelectTrigger id="grn-reject-reason">
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
            <Label htmlFor="grn-reject-notes">
              Notes {notesRequired && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="grn-reject-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                notesRequired
                  ? 'Describe the non-conformance (required for “Other”).'
                  : 'Optional additional context for the supplier and audit trail.'
              }
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit}>
            {isLoading ? 'Rejecting…' : 'Confirm Rejection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
