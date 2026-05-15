import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useWarehouseItems } from "@/hooks/useWarehouseItems";
import { ItemSelector } from "@/components/common/ItemSelector";
import { useCreatePartialPiece } from "@/hooks/warehouse/usePartialPieces";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AddPartialPieceDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { locations } = useWarehouseLocations();
  const { items } = useWarehouseItems();
  const create = useCreatePartialPiece();

  const [parentItemId, setParentItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [binId, setBinId] = useState<string>("");
  const [sizeValue, setSizeValue] = useState("");
  const [sizeUom, setSizeUom] = useState("");
  const [pieceCode, setPieceCode] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  const item = useMemo(
    () => (items as Array<{ id: string; secondary_uom: string | null; base_uom: string | null; unit_cost: number | null }>).find(i => i.id === parentItemId),
    [items, parentItemId],
  );

  useEffect(() => {
    if (item) {
      if (!sizeUom) setSizeUom(item.secondary_uom || item.base_uom || "");
      if (!unitCost && item.unit_cost != null) setUnitCost(String(item.unit_cost));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentItemId]);

  const { data: bins = [] } = useQuery({
    queryKey: ["bins-for-location", locationId],
    enabled: !!locationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_bins")
        .select("id, bin_code")
        .eq("location_id", locationId)
        .order("bin_code");
      if (error) throw error;
      return data as Array<{ id: string; bin_code: string }>;
    },
  });

  function reset() {
    setParentItemId(""); setLocationId(""); setBinId("");
    setSizeValue(""); setSizeUom(""); setPieceCode("");
    setSourceRef(""); setBatchNumber(""); setUnitCost(""); setLabel(""); setNotes("");
  }

  async function submit() {
    if (!selectedCompany?.id) return;
    if (!parentItemId || !locationId || !sizeValue || !sizeUom) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        company_id: selectedCompany.id,
        parent_item_id: parentItemId,
        size_value: Number(sizeValue),
        size_uom: sizeUom || null,
        location_id: locationId,
        bin_id: binId || null,
        piece_code: pieceCode.trim() || null,
        source_ref: sourceRef.trim() || null,
        batch_number: batchNumber.trim() || null,
        unit_cost: unitCost ? Number(unitCost) : null,
        label: label.trim() || null,
        notes: notes.trim() || null,
      });
      toast({ title: "Partial piece added" });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Failed to add", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Partial Piece</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Parent Item *</Label>
            <ItemSelector
              value={parentItemId}
              onSelect={(it) => setParentItemId(it?.id ?? "")}
              placeholder="Search by item code or name…"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Auto piece code: <span className="font-mono">{(items as Array<{ id: string; item_code: string }>).find(i => i.id === parentItemId)?.item_code ?? "ITEM-CODE"}/PQ-NNNN</span>
            </p>
          </div>
          <div>
            <Label>Size *</Label>
            <Input type="number" step="0.0001" value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} />
          </div>
          <div>
            <Label>UOM *</Label>
            <Input value={sizeUom} onChange={(e) => setSizeUom(e.target.value)} placeholder="m, mm, kg, m²…" />
          </div>
          <div>
            <Label>Location *</Label>
            <Select value={locationId} onValueChange={(v) => { setLocationId(v); setBinId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                {(locations as Array<{ id: string; location_code: string; name?: string }>).map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.location_code}{l.name ? ` — ${l.name}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bin</Label>
            <Select value={binId} onValueChange={setBinId} disabled={!locationId}>
              <SelectTrigger><SelectValue placeholder="(optional)" /></SelectTrigger>
              <SelectContent>
                {bins.map(b => <SelectItem key={b.id} value={b.id}>{b.bin_code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Piece Code</Label>
            <Input value={pieceCode} onChange={(e) => setPieceCode(e.target.value)} placeholder="auto-generated if blank" />
          </div>
          <div>
            <Label>Unit Cost</Label>
            <Input type="number" step="0.0001" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </div>
          <div>
            <Label>Source Ref</Label>
            <Input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="GRN-123 / WO-77" />
          </div>
          <div>
            <Label>Batch No.</Label>
            <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Label / Tag</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Reel-A offcut" />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Saving…" : "Add piece"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
