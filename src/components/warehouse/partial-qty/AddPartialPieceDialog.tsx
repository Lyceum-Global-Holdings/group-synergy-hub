import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useItemUnits } from "@/hooks/useItemUnits";
import { PartialPieceItemPicker, type PartialPieceItemOption } from "@/components/warehouse/partial-qty/PartialPieceItemPicker";
import { usePartialPieceItems } from "@/hooks/warehouse/usePartialPieces";
import {
  useCreatePartialPiece,
  useCreatePartialPiecesBulk,
  type BulkPartialPieceRow,
} from "@/hooks/warehouse/usePartialPieces";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useBinsForLocation } from "@/hooks/warehouse/useBinsForLocation";
import { UomConversionHint } from "@/components/warehouse/partial-qty/UomConversionHint";
import { useToast } from "@/hooks/use-toast";
import { Lock, Plus, Trash2, Copy, ClipboardPaste } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultParentItemId?: string;
}

const MAX_BULK_ROWS = 200;

interface BulkRowState {
  key: string;
  size_value: string;
  piece_code: string;
  label_suffix: string;
}

function emptyRow(): BulkRowState {
  return { key: crypto.randomUUID(), size_value: "", piece_code: "", label_suffix: "" };
}

export function AddPartialPieceDialog({ open, onOpenChange, defaultParentItemId }: Props) {
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { toast } = useToast();
  const { locations } = useWarehouseLocations();
  const { data: items = [] } = usePartialPieceItems();
  const { units } = useItemUnits();
  const create = useCreatePartialPiece();
  const createBulk = useCreatePartialPiecesBulk();

  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Shared header state (used by both modes)
  const [parentItemId, setParentItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [binId, setBinId] = useState<string>("");
  const [sizeUom, setSizeUom] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  // Single-mode only
  const [sizeValue, setSizeValue] = useState("");
  const [pieceCode, setPieceCode] = useState("");

  // Bulk-mode rows
  const [rows, setRows] = useState<BulkRowState[]>([emptyRow(), emptyRow(), emptyRow()]);

  const item = useMemo<PartialPieceItemOption | undefined>(
    () => items.find(i => i.parent_item_id === parentItemId),
    [items, parentItemId],
  );

  useEffect(() => {
    if (item) {
      if (!sizeUom) {
        const candidate = item.secondary_uom || item.base_uom || "";
        const abbrs = (units as Array<{ abbreviation: string }>).map(u => u.abbreviation);
        if (candidate && abbrs.includes(candidate)) setSizeUom(candidate);
      }
      if (!unitCost && item.unit_cost != null) setUnitCost(String(item.unit_cost));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentItemId, units]);

  // Inherit the active global location filter (SAP EWM / Oracle WMS pattern).
  useEffect(() => {
    if (!open) return;
    if (globalLocationId) {
      setLocationId(globalLocationId);
      setBinId("");
    }
  }, [open, globalLocationId]);

  // Pre-select parent item when invoked from a grouped parent row.
  useEffect(() => {
    if (open && defaultParentItemId) setParentItemId(defaultParentItemId);
  }, [open, defaultParentItemId]);

  const lockedLocation = !!globalLocationId;
  const lockedLocationName = useMemo(() => {
    if (!globalLocationId) return null;
    const l = (locations as Array<{ id: string; name?: string; location_code?: string }>)
      .find(x => x.id === globalLocationId);
    return l?.name || l?.location_code || null;
  }, [globalLocationId, locations]);

  const { data: bins = [] } = useBinsForLocation(locationId);

  function reset() {
    setMode("single");
    setParentItemId(""); setLocationId(""); setBinId("");
    setSizeValue(""); setSizeUom(""); setPieceCode("");
    setSourceRef(""); setBatchNumber(""); setUnitCost(""); setLabel(""); setNotes("");
    setRows([emptyRow(), emptyRow(), emptyRow()]);
  }

  // ---- Bulk row helpers ----
  function updateRow(key: string, patch: Partial<BulkRowState>) {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows(rs => (rs.length >= MAX_BULK_ROWS ? rs : [...rs, emptyRow()]));
  }
  function duplicateRow(key: string) {
    setRows(rs => {
      if (rs.length >= MAX_BULK_ROWS) return rs;
      const idx = rs.findIndex(r => r.key === key);
      if (idx < 0) return rs;
      const copy = { ...rs[idx], key: crypto.randomUUID(), piece_code: "" };
      return [...rs.slice(0, idx + 1), copy, ...rs.slice(idx + 1)];
    });
  }
  function removeRow(key: string) {
    setRows(rs => (rs.length > 1 ? rs.filter(r => r.key !== key) : rs));
  }
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast({ title: "Clipboard is empty", variant: "destructive" });
        return;
      }
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsed: BulkRowState[] = lines.slice(0, MAX_BULK_ROWS).map(line => {
        const cols = line.split(/[,\t;]/).map(c => c.trim());
        return {
          key: crypto.randomUUID(),
          size_value: cols[0] ?? "",
          piece_code: cols[1] ?? "",
          label_suffix: cols[2] ?? "",
        };
      });
      if (!parsed.length) return;
      setRows(parsed);
      toast({ title: `Pasted ${parsed.length} row${parsed.length === 1 ? "" : "s"}` });
    } catch {
      toast({ title: "Could not read clipboard", description: "Allow clipboard access and try again.", variant: "destructive" });
    }
  }

  const filledRows = useMemo(
    () => rows.filter(r => r.size_value.trim() !== "" && Number(r.size_value) > 0),
    [rows],
  );
  const totalSize = useMemo(
    () => filledRows.reduce((s, r) => s + Number(r.size_value || 0), 0),
    [filledRows],
  );

  // ---- Submit (single) ----
  async function submitSingle() {
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

  // ---- Submit (bulk) ----
  async function submitBulk() {
    if (!selectedCompany?.id) return;
    if (!parentItemId || !locationId || !sizeUom) {
      toast({ title: "Missing required header fields", description: "Item, location and UOM are required.", variant: "destructive" });
      return;
    }
    if (filledRows.length === 0) {
      toast({ title: "Add at least one row with a size > 0", variant: "destructive" });
      return;
    }
    // Client-side duplicate piece-code check within the batch
    const codes = filledRows.map(r => r.piece_code.trim()).filter(Boolean);
    const dupSet = new Set<string>();
    const seen = new Set<string>();
    for (const c of codes) {
      if (seen.has(c)) dupSet.add(c);
      seen.add(c);
    }
    if (dupSet.size) {
      toast({
        title: "Duplicate piece codes in the batch",
        description: Array.from(dupSet).join(", "),
        variant: "destructive",
      });
      return;
    }

    const labelPrefix = label.trim();
    const payloadRows: BulkPartialPieceRow[] = filledRows.map(r => {
      const suffix = r.label_suffix.trim();
      const finalLabel = [labelPrefix, suffix].filter(Boolean).join(" ");
      return {
        size_value: Number(r.size_value),
        piece_code: r.piece_code.trim() || null,
        label: finalLabel || null,
      };
    });

    try {
      const ids = await createBulk.mutateAsync({
        company_id: selectedCompany.id,
        parent_item_id: parentItemId,
        location_id: locationId,
        bin_id: binId || null,
        shared: {
          size_uom: sizeUom || null,
          source_ref: sourceRef.trim() || null,
          batch_number: batchNumber.trim() || null,
          unit_cost: unitCost ? Number(unitCost) : null,
          notes: notes.trim() || null,
        },
        rows: payloadRows,
      });
      toast({ title: `Added ${ids.length} partial piece${ids.length === 1 ? "" : "s"}` });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Bulk add failed — no pieces were saved",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  const isSaving = create.isPending || createBulk.isPending;
  const itemCode = (items as Array<{ id: string; item_code: string }>).find(i => i.id === parentItemId)?.item_code ?? "ITEM-CODE";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Partial Piece</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "bulk")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single piece</TabsTrigger>
            <TabsTrigger value="bulk">Multiple rows</TabsTrigger>
          </TabsList>

          {/* Shared header */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2">
              <Label>Parent Item *</Label>
              <ItemSelector
                value={parentItemId}
                onSelect={(it) => setParentItemId(it?.id ?? "")}
                placeholder="Search by item code or name…"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto piece code: <span className="font-mono">{itemCode}/PQ-NNNN</span>
              </p>
            </div>
            <div>
              <Label>UOM *</Label>
              <Select value={sizeUom} onValueChange={setSizeUom}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {(units as Array<{ id: string; name: string; abbreviation: string }>).map(u => (
                    <SelectItem key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <UomConversionHint
                selectedUom={sizeUom}
                baseUom={item?.base_uom}
                secondaryUom={item?.secondary_uom}
                trackSecondary={item?.track_secondary_quantity}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Location * {lockedLocation && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <Select
                value={locationId}
                onValueChange={(v) => { setLocationId(v); setBinId(""); }}
                disabled={lockedLocation}
              >
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {(locations as Array<{ id: string; location_code: string; name?: string }>).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.location_code}{l.name ? ` — ${l.name}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lockedLocation && (
                <p className="text-xs text-muted-foreground mt-1">
                  Scoped by header filter{lockedLocationName ? `: ${lockedLocationName}` : ""}.
                </p>
              )}
            </div>
            <div>
              <Label>Bin</Label>
              <Select value={binId} onValueChange={setBinId} disabled={!locationId}>
                <SelectTrigger><SelectValue placeholder="(optional)" /></SelectTrigger>
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
              <Label>{mode === "bulk" ? "Label prefix (applied to each row)" : "Label / Tag"}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Reel-A offcut" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <TabsContent value="single" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Size *</Label>
                <Input type="number" step="0.0001" value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} />
              </div>
              <div>
                <Label>Piece Code</Label>
                <Input value={pieceCode} onChange={(e) => setPieceCode(e.target.value)} placeholder="auto-generated if blank" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">
                {filledRows.length} row{filledRows.length === 1 ? "" : "s"} · total {totalSize.toFixed(4).replace(/\.?0+$/, "")} {sizeUom}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={pasteFromClipboard}>
                  <ClipboardPaste className="h-4 w-4 mr-1" /> Paste
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={rows.length >= MAX_BULK_ROWS}>
                  <Plus className="h-4 w-4 mr-1" /> Add row
                </Button>
              </div>
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2 w-10">#</th>
                    <th className="text-left p-2">Size *</th>
                    <th className="text-left p-2">Piece code</th>
                    <th className="text-left p-2">Label suffix</th>
                    <th className="p-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.key} className="border-t">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.0001"
                          value={r.size_value}
                          onChange={(e) => updateRow(r.key, { size_value: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={r.piece_code}
                          onChange={(e) => updateRow(r.key, { piece_code: e.target.value })}
                          placeholder="auto"
                          className="h-8 font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={r.label_suffix}
                          onChange={(e) => updateRow(r.key, { label_suffix: e.target.value })}
                          placeholder="optional"
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 justify-end">
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateRow(r.key)} title="Duplicate">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRow(r.key)} disabled={rows.length === 1} title="Remove">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tip: paste from Excel — columns <span className="font-mono">size, piece_code, label</span>. Max {MAX_BULK_ROWS} rows per batch. All rows commit together or none.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {mode === "single" ? (
            <Button onClick={submitSingle} disabled={isSaving}>
              {isSaving ? "Saving…" : "Add piece"}
            </Button>
          ) : (
            <Button onClick={submitBulk} disabled={isSaving || filledRows.length === 0}>
              {isSaving ? "Saving…" : `Add ${filledRows.length || ""} piece${filledRows.length === 1 ? "" : "s"}`.trim()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
