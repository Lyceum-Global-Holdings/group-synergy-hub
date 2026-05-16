import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConsumePartialPiecePieces } from "@/hooks/warehouse/usePartialPieces";
import { CONSUME_REASONS, type PartialPieceRow } from "@/types/partialPiece";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  piece: PartialPieceRow | null;
}

export function ConsumePartialPieceDialog({ open, onOpenChange, piece }: Props) {
  const { toast } = useToast();
  const consume = useConsumePartialPiecePieces();
  const [pieces, setPieces] = useState("1");
  const [residual, setResidual] = useState("0");
  const [reason, setReason] = useState("consumption");
  const [postToStock, setPostToStock] = useState(true);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && piece) {
      setPieces(piece.piece_count > 1 ? "1" : String(piece.piece_count));
      setResidual("0");
    }
  }, [open, piece]);

  function reset() {
    setPieces("1"); setResidual("0"); setReason("consumption");
    setPostToStock(true); setReference(""); setNotes("");
  }

  const piecesNum = Math.max(0, Math.trunc(Number(pieces) || 0));
  const residualNum = Math.max(0, Number(residual) || 0);
  const sizeValue = piece ? Number(piece.size_value) : 0;
  const maxPieces = piece ? piece.piece_count : 0;
  const totalConsumed = piecesNum * sizeValue + residualNum;
  const residualAllowed = piece ? piecesNum < maxPieces : false;

  async function submit() {
    if (!piece) return;
    if (piecesNum < 0 || piecesNum > maxPieces) {
      toast({ title: `Pieces must be between 0 and ${maxPieces}`, variant: "destructive" });
      return;
    }
    if (residualNum < 0 || residualNum >= sizeValue) {
      toast({ title: `Residual must be between 0 and < ${sizeValue}`, variant: "destructive" });
      return;
    }
    if (piecesNum === 0 && residualNum === 0) {
      toast({ title: "Enter pieces or a residual size to consume", variant: "destructive" });
      return;
    }
    if (!residualAllowed && residualNum > 0) {
      toast({ title: "Residual only valid when at least 1 piece is left", variant: "destructive" });
      return;
    }
    try {
      const res = await consume.mutateAsync({
        id: piece.id,
        pieces: piecesNum,
        residual_size: residualNum,
        reason,
        post_to_stock: postToStock,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      toast({
        title: "Piece consumed",
        description:
          `Consumed ${res.pieces_consumed} pcs` +
          (res.residual_size > 0 ? ` + ${res.residual_size} ${piece.size_uom} residual` : "") +
          ` · total ${res.total_consumed} ${piece.size_uom}` +
          (res.residual_id ? " · remnant created" : ""),
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
              Available:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {piece.piece_count} pcs × {piece.size_value} {piece.size_uom}
                {" "}= {(piece.piece_count * Number(piece.size_value)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {piece.size_uom}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pieces to consume *</Label>
                <Input
                  type="number" step="1" min={0} max={maxPieces}
                  value={pieces}
                  onChange={(e) => setPieces(e.target.value.replace(/[^\d]/g, ""))}
                />
                <p className="text-xs text-muted-foreground mt-1">of {maxPieces}</p>
              </div>
              <div>
                <Label>Residual size on last piece</Label>
                <Input
                  type="number" step="0.0001" min={0}
                  max={sizeValue}
                  value={residual}
                  onChange={(e) => setResidual(e.target.value)}
                  disabled={!residualAllowed}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {residualAllowed
                    ? `0 to < ${sizeValue} ${piece.size_uom}; creates a smaller remnant`
                    : "Set pieces < total to enable"}
                </p>
              </div>
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm tabular-nums">
              Total consumed:{" "}
              <span className="font-medium">
                {totalConsumed.toLocaleString(undefined, { maximumFractionDigits: 4 })} {piece.size_uom}
              </span>
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
