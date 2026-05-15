import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSplitPartialPiece } from "@/hooks/warehouse/usePartialPieces";
import type { PartialPieceRow } from "@/types/partialPiece";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  piece: PartialPieceRow | null;
}

export function SplitPartialPieceDialog({ open, onOpenChange, piece }: Props) {
  const { toast } = useToast();
  const split = useSplitPartialPiece();
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  function reset() { setA(""); setB(""); }

  function handleAChange(v: string) {
    setA(v);
    if (piece && v && !isNaN(Number(v))) {
      const rem = piece.size_value - Number(v);
      if (rem > 0) setB(String(Number(rem.toFixed(4))));
    }
  }

  async function submit() {
    if (!piece) return;
    const na = Number(a), nb = Number(b);
    if (!na || !nb || na <= 0 || nb <= 0) {
      toast({ title: "Both sizes must be > 0", variant: "destructive" });
      return;
    }
    if (Math.round((na + nb) * 10000) !== Math.round(piece.size_value * 10000)) {
      toast({ title: `Sum must equal ${piece.size_value}`, variant: "destructive" });
      return;
    }
    try {
      await split.mutateAsync({ id: piece.id, first_size: na, second_size: nb });
      toast({ title: "Piece split" });
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
          <DialogTitle>Split Piece {piece?.piece_code}</DialogTitle>
        </DialogHeader>
        {piece && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Original size: <span className="font-medium text-foreground tabular-nums">{piece.size_value} {piece.size_uom}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Piece A size *</Label>
                <Input type="number" step="0.0001" value={a} onChange={(e) => handleAChange(e.target.value)} />
              </div>
              <div>
                <Label>Piece B size *</Label>
                <Input type="number" step="0.0001" value={b} onChange={(e) => setB(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Original is marked consumed; two new pieces are created.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={split.isPending}>{split.isPending ? "Splitting…" : "Confirm split"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
