import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useConsumePartialPiecePieces } from "@/hooks/warehouse/usePartialPieces";
import { CONSUME_REASONS, type PartialPieceRow } from "@/types/partialPiece";
import { useToast } from "@/hooks/use-toast";
import { parseQty, QTY_DECIMALS } from "@/lib/quantityInput";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  piece: PartialPieceRow | null;
}

type Mode = "pieces" | "size";

// Round to QTY_DECIMALS to avoid float drift (e.g. 0.1+0.2)
function round(n: number) {
  const f = Math.pow(10, QTY_DECIMALS);
  return Math.round(n * f) / f;
}

export function ConsumePartialPieceDialog({ open, onOpenChange, piece }: Props) {
  const { toast } = useToast();
  const consume = useConsumePartialPiecePieces();

  const [mode, setMode] = useState<Mode>("pieces");
  const [pieces, setPieces] = useState("1");
  const [residual, setResidual] = useState("0");
  const [sizeQty, setSizeQty] = useState("");
  const [reason, setReason] = useState("consumption");
  const [postToStock, setPostToStock] = useState(true);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && piece) {
      setMode("pieces");
      setPieces(piece.piece_count > 1 ? "1" : String(piece.piece_count));
      setResidual("0");
      setSizeQty(String(piece.size_value));
    }
  }, [open, piece]);

  function reset() {
    setMode("pieces");
    setPieces("1"); setResidual("0"); setSizeQty("");
    setReason("consumption"); setPostToStock(true);
    setReference(""); setNotes("");
  }

  const sizeValue = piece ? Number(piece.size_value) : 0;
  const maxPieces = piece ? piece.piece_count : 0;
  const maxTotal = round(maxPieces * sizeValue);

  // Resolve (pieces, residual) for whichever mode is active.
  const resolved = useMemo(() => {
    if (!piece) return { pieces: 0, residual: 0, total: 0, error: null as string | null };
    if (mode === "pieces") {
      const p = Math.max(0, Math.trunc(Number(pieces) || 0));
      const r = Math.max(0, round(Number(residual) || 0));
      return { pieces: p, residual: r, total: round(p * sizeValue + r), error: null };
    }
    // size mode
    const qty = parseQty(sizeQty) ?? 0;
    if (qty <= 0) return { pieces: 0, residual: 0, total: 0, error: null };
    if (qty > maxTotal + 1e-9) {
      return { pieces: 0, residual: 0, total: qty, error: `Exceeds available (${maxTotal} ${piece.size_uom})` };
    }
    let p = Math.floor(qty / sizeValue + 1e-9);
    let r = round(qty - p * sizeValue);
    // If qty exactly equals total, no residual.
    if (p >= maxPieces) { p = maxPieces; r = 0; }
    return { pieces: p, residual: r, total: round(p * sizeValue + r), error: null };
  }, [mode, pieces, residual, sizeQty, piece, sizeValue, maxPieces, maxTotal]);

  const residualAllowed = piece ? resolved.pieces < maxPieces : false;

  async function submit() {
    if (!piece) return;
    if (resolved.error) {
      toast({ title: resolved.error, variant: "destructive" });
      return;
    }
    const { pieces: p, residual: r } = resolved;
    if (p < 0 || p > maxPieces) {
      toast({ title: `Pieces must be between 0 and ${maxPieces}`, variant: "destructive" });
      return;
    }
    if (r < 0 || r >= sizeValue) {
      toast({ title: `Residual must be between 0 and < ${sizeValue}`, variant: "destructive" });
      return;
    }
    if (p === 0 && r === 0) {
      toast({ title: "Enter pieces or a size to consume", variant: "destructive" });
      return;
    }
    if (!residualAllowed && r > 0) {
      toast({ title: "Residual only valid when at least 1 piece is left", variant: "destructive" });
      return;
    }
    try {
      const res = await consume.mutateAsync({
        id: piece.id,
        pieces: p,
        residual_size: r,
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

  const remainingPieces = piece ? maxPieces - resolved.pieces - (resolved.residual > 0 ? 1 : 0) : 0;
  const remnantSize = resolved.residual > 0 ? round(sizeValue - resolved.residual) : 0;

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
                {" "}= {maxTotal.toLocaleString(undefined, { maximumFractionDigits: 4 })} {piece.size_uom}
              </span>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pieces">By pieces</TabsTrigger>
                <TabsTrigger value="size">By size ({piece.size_uom})</TabsTrigger>
              </TabsList>

              <TabsContent value="pieces" className="mt-3">
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
              </TabsContent>

              <TabsContent value="size" className="mt-3">
                <div>
                  <Label>Quantity to issue ({piece.size_uom}) *</Label>
                  <Input
                    type="number" step="0.001" min={0} max={maxTotal}
                    value={sizeQty}
                    onChange={(e) => setSizeQty(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Max {maxTotal} {piece.size_uom}. Whole pieces are consumed first; any remainder is peeled from the last piece as a remnant.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm tabular-nums space-y-0.5">
              <div>
                Allocation:{" "}
                <span className="font-medium">
                  {resolved.pieces} pcs × {sizeValue} {piece.size_uom}
                  {resolved.residual > 0 && <> {" + "}{resolved.residual} {piece.size_uom} residual</>}
                </span>
              </div>
              <div>
                Total consumed:{" "}
                <span className="font-medium">
                  {resolved.total.toLocaleString(undefined, { maximumFractionDigits: 4 })} {piece.size_uom}
                </span>
              </div>
              {resolved.residual > 0 && (
                <div className="text-xs text-muted-foreground">
                  Remnant created: 1 pc × {remnantSize} {piece.size_uom}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Remaining in group: {Math.max(0, remainingPieces)} pcs × {sizeValue} {piece.size_uom}
              </div>
              {resolved.error && (
                <div className="text-xs text-destructive">{resolved.error}</div>
              )}
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
          <Button onClick={submit} disabled={consume.isPending || !!resolved.error}>
            {consume.isPending ? "Posting…" : "Confirm consume"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
