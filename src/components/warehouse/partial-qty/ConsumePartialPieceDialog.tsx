import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConsumePartialPiece } from "@/hooks/warehouse/usePartialPieces";
import { CONSUME_REASONS, type PartialPieceRow } from "@/types/partialPiece";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  piece: PartialPieceRow | null;
}

export function ConsumePartialPieceDialog({ open, onOpenChange, piece }: Props) {
  const { toast } = useToast();
  const consume = useConsumePartialPiece();
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("consumption");
  const [postToStock, setPostToStock] = useState(true);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setQty(""); setReason("consumption"); setPostToStock(true); setReference(""); setNotes("");
  }

  async function submit() {
    if (!piece) return;
    const n = Number(qty);
    if (!n || n <= 0 || n > piece.size_value) {
      toast({ title: `Quantity must be between 0 and ${piece.size_value}`, variant: "destructive" });
      return;
    }
    try {
      const res = await consume.mutateAsync({
        id: piece.id,
        quantity: n,
        reason,
        post_to_stock: postToStock,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      toast({
        title: "Piece consumed",
        description: res.residual_id ? "Residual remnant created automatically." : undefined,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consume Piece {piece?.piece_code}</DialogTitle>
        </DialogHeader>
        {piece && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {piece.parent_item_code} — {piece.parent_item_name}<br />
              Available: <span className="font-medium text-foreground tabular-nums">{piece.size_value} {piece.size_uom}</span>
            </div>
            <div>
              <Label>Quantity to consume *</Label>
              <Input
                type="number" step="0.0001"
                value={qty} onChange={(e) => setQty(e.target.value)}
                max={piece.size_value} min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If less than total, a residual remnant is auto-created.
              </p>
            </div>
            <div>
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONSUME_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="post-stock" checked={postToStock} onCheckedChange={(v) => setPostToStock(!!v)} />
              <Label htmlFor="post-stock" className="cursor-pointer">
                Also reduce parent item stock (post to ledger)
              </Label>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="WO-123, Job-77…" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={consume.isPending}>{consume.isPending ? "Posting…" : "Confirm consume"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
