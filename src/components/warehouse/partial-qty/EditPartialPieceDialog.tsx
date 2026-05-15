import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdatePartialPiece, useDeletePartialPiece } from "@/hooks/warehouse/usePartialPieces";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useItemUnits } from "@/hooks/useItemUnits";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useBinsForLocation } from "@/hooks/warehouse/useBinsForLocation";
import { UomConversionHint } from "@/components/warehouse/partial-qty/UomConversionHint";
import type { PartialPieceRow } from "@/types/partialPiece";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  piece: PartialPieceRow | null;
}

export function EditPartialPieceDialog({ open, onOpenChange, piece }: Props) {
  const { toast } = useToast();
  const update = useUpdatePartialPiece();
  const del = useDeletePartialPiece();
  const { locations } = useWarehouseLocations();
  const { units } = useItemUnits();

  const [sizeValue, setSizeValue] = useState("");
  const [sizeUom, setSizeUom] = useState("");
  const [locationId, setLocationId] = useState("");
  const [binId, setBinId] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (piece) {
      setSizeValue(String(piece.size_value));
      setSizeUom(piece.size_uom);
      setLocationId(piece.location_id);
      setBinId(piece.bin_id ?? "");
      setSourceRef(piece.source_ref ?? "");
      setBatchNumber(piece.batch_number ?? "");
      setUnitCost(piece.unit_cost != null ? String(piece.unit_cost) : "");
      setLabel(piece.label ?? "");
      setNotes(piece.notes ?? "");
    }
  }, [piece]);

  const { data: bins = [] } = useBinsForLocation(locationId);

  const editable = useMemo(() => piece?.status === "available" || piece?.status === "reserved", [piece]);

  async function submit() {
    if (!piece) return;
    try {
      await update.mutateAsync({
        id: piece.id,
        payload: {
          size_value: sizeValue,
          size_uom: sizeUom,
          location_id: locationId,
          bin_id: binId || null,
          source_ref: sourceRef.trim() || null,
          batch_number: batchNumber.trim() || null,
          unit_cost: unitCost || null,
          label: label.trim() || null,
          notes: notes.trim() || null,
        },
      });
      toast({ title: "Updated" });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!piece) return;
    if (!confirm(`Delete piece ${piece.piece_code}? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(piece.id);
      toast({ title: "Deleted" });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Piece {piece?.piece_code}</DialogTitle>
        </DialogHeader>
        {piece && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 text-sm text-muted-foreground">
              {piece.parent_item_code} — {piece.parent_item_name} · status: <span className="font-medium text-foreground">{piece.status}</span>
            </div>
            <div>
              <Label>Size</Label>
              <Input type="number" step="0.0001" value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} disabled={!editable} />
            </div>
            <div>
              <Label>UOM</Label>
              <Select value={sizeUom} onValueChange={setSizeUom} disabled={!editable}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const list = units as Array<{ id: string; name: string; abbreviation: string }>;
                    const known = list.some(u => u.abbreviation === sizeUom);
                    return (
                      <>
                        {!known && sizeUom && (
                          <SelectItem value={sizeUom}>{sizeUom} (legacy)</SelectItem>
                        )}
                        {list.map(u => (
                          <SelectItem key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</SelectItem>
                        ))}
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
              <UomConversionHint selectedUom={sizeUom} baseUom={piece?.base_uom} />
            </div>
            <div>
              <Label>Location</Label>
              <Select value={locationId} onValueChange={(v) => { setLocationId(v); setBinId(""); }} disabled={!editable}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(locations as Array<{ id: string; location_code: string }>).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.location_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bin</Label>
              <Select value={binId} onValueChange={setBinId} disabled={!editable || !locationId}>
                <SelectTrigger><SelectValue placeholder="(none)" /></SelectTrigger>
                <SelectContent>
                  {bins.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bin_code}
                      {b.inherited_from_location_name && (
                        <span className="text-xs text-muted-foreground ml-2">
                          · inherited from {b.inherited_from_location_name}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit Cost</Label>
              <Input type="number" step="0.0001" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} disabled={!editable} />
            </div>
            <div>
              <Label>Source Ref</Label>
              <Input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} disabled={!editable} />
            </div>
            <div>
              <Label>Batch No.</Label>
              <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} disabled={!editable} />
            </div>
            <div>
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={!editable} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={!editable} />
            </div>
          </div>
        )}
        <DialogFooter className="justify-between">
          <Button variant="destructive" onClick={handleDelete} disabled={!editable || del.isPending}>
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={submit} disabled={!editable || update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
