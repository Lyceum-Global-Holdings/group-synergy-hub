import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePoAmendment } from "@/hooks/usePoAmendments";
import type { PoAmendmentType } from "@/types/purchaseOrder";

interface CreatePoAmendmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string;
}

const amendmentTypes: { value: PoAmendmentType; label: string }[] = [
  { value: 'price_change', label: 'Price Change' },
  { value: 'quantity_change', label: 'Quantity Change' },
  { value: 'delivery_date_change', label: 'Delivery Date Change' },
  { value: 'terms_change', label: 'Terms Change' },
  { value: 'item_addition', label: 'Item Addition' },
  { value: 'item_removal', label: 'Item Removal' },
  { value: 'other', label: 'Other' },
];

export function CreatePoAmendmentDialog({
  open,
  onOpenChange,
  poId,
}: CreatePoAmendmentDialogProps) {
  const [amendmentType, setAmendmentType] = useState<PoAmendmentType>('price_change');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const createAmendment = useCreatePoAmendment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      return;
    }

    await createAmendment.mutateAsync({
      po_id: poId,
      amendment_type: amendmentType,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });

    setAmendmentType('price_change');
    setReason('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create PO Amendment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amendment-type">Amendment Type *</Label>
            <Select value={amendmentType} onValueChange={(value) => setAmendmentType(value as PoAmendmentType)}>
              <SelectTrigger id="amendment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {amendmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for this amendment..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createAmendment.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createAmendment.isPending || !reason.trim()}>
              {createAmendment.isPending ? "Creating..." : "Create Amendment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
