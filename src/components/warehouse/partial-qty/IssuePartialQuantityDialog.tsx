import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useIssuePartialQuantity,
  type PartialQuantityRow,
} from "@/hooks/warehouse/usePartialQuantities";

interface Props {
  row: PartialQuantityRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

// GS1 CBV-aligned movement disposition reasons
const REASONS: { value: string; label: string }[] = [
  { value: "consumption", label: "Consumption" },
  { value: "internal_transfer", label: "Internal Transfer" },
  { value: "sample", label: "Sample / R&D" },
  { value: "waste", label: "Waste / Scrap" },
  { value: "return_to_vendor", label: "Return to Vendor" },
  { value: "correction", label: "Correction" },
];

export function IssuePartialQuantityDialog({ row, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const issue = useIssuePartialQuantity();
  const [qty, setQty] = useState<string>("");
  const [secQty, setSecQty] = useState<string>("");
  const [reason, setReason] = useState<string>("consumption");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      setQty("");
      setSecQty("");
      setReason("consumption");
      setReference("");
      setNotes("");
    }
  }, [open, row?.allocation_id]);

  if (!row) return null;
  const max = Number(row.allocated_quantity ?? 0);

  const submit = async () => {
    const q = Number(qty);
    if (!q || q <= 0 || q > max) {
      toast({
        title: "Invalid quantity",
        description: `Enter a value between 0 and ${max}`,
        variant: "destructive",
      });
      return;
    }
    try {
      await issue.mutateAsync({
        allocation_id: row.allocation_id,
        quantity: q,
        secondary_quantity: row.track_secondary_quantity && secQty ? Number(secQty) : null,
        reason_code: reason,
        reference: reference || null,
        notes: notes || null,
      });
      toast({ title: "Issued", description: `${q} ${row.base_uom ?? ""} from ${row.bin_code}` });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Issue failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue Partial Quantity</DialogTitle>
          <DialogDescription>
            {row.item_code} — {row.item_name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Location</div>
            <div className="font-medium">{row.location_name ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Bin</div>
            <div className="font-medium">{row.bin_code}</div>
          </div>
          <div>
            <div className="text-muted-foreground">On hand</div>
            <div className="font-medium">
              {max} {row.base_uom ?? ""}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Available</div>
            <div className="font-medium">
              {row.available_quantity} {row.base_uom ?? ""}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="pq-qty">Quantity to issue *</Label>
            <Input
              id="pq-qty"
              type="number"
              min={0}
              max={max}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={`max ${max}`}
            />
          </div>

          {row.track_secondary_quantity && (
            <div>
              <Label htmlFor="pq-sqty">Secondary qty ({row.secondary_uom ?? "pcs"})</Label>
              <Input
                id="pq-sqty"
                type="number"
                min={0}
                step="any"
                value={secQty}
                onChange={(e) => setSecQty(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="pq-reason">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="pq-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pq-ref">Reference</Label>
            <Input
              id="pq-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="MIR / WO / project no."
            />
          </div>

          <div>
            <Label htmlFor="pq-notes">Notes</Label>
            <Textarea
              id="pq-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={issue.isPending}>
            {issue.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
