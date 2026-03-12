import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useProductionSectors, useStageTemplates, useCreateProductionOrder, useCreateBatchProductionOrders, useBOMs, useCPOs } from "@/hooks/useProduction";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateProductionOrderDialog({ open, onOpenChange }: Props) {
  const { data: sectors } = useProductionSectors();
  const { data: boms } = useBOMs();
  const { data: cpos } = useCPOs();
  const createMutation = useCreateProductionOrder();
  const batchCreateMutation = useCreateBatchProductionOrders();

  const [sectorId, setSectorId] = useState("");
  const [productName, setProductName] = useState("");
  const [styleNo, setStyleNo] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [cpoId, setCpoId] = useState("");
  const [bomId, setBomId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  // Per-item BOM overrides: itemId -> bomId
  const [itemBomOverrides, setItemBomOverrides] = useState<Record<string, string>>({});

  const { data: stageTemplates } = useStageTemplates(sectorId || undefined);

  // Get CPO items for selected CPO
  const selectedCpo = useMemo(() => {
    if (!cpoId || cpoId === "none" || !cpos) return null;
    return cpos.find((c) => c.id === cpoId) || null;
  }, [cpoId, cpos]);

  const cpoItems = selectedCpo?.items || [];
  const hasCpoItems = cpoItems.length > 0;

  // Auto-match BOMs to CPO items by product_master_id
  const itemBomMatches = useMemo(() => {
    if (!hasCpoItems || !boms) return {};
    const matches: Record<string, { id: string; bom_number: string } | null> = {};
    for (const item of cpoItems as any[]) {
      if (item.product_master_id) {
        // Find active BOM matching product_master_id
        const match = boms.find(
          (b) => b.product_master_id === item.product_master_id && b.status === "active"
        ) || boms.find(
          (b) => b.product_master_id === item.product_master_id
        );
        matches[item.id] = match ? { id: match.id, bom_number: match.bom_number } : null;
      } else {
        matches[item.id] = null;
      }
    }
    return matches;
  }, [cpoItems, boms, hasCpoItems]);

  // Get effective BOM for an item (override > auto-match)
  const getItemBomId = (itemId: string): string | undefined => {
    const override = itemBomOverrides[itemId];
    if (override && override !== "none") return override;
    if (override === "none") return undefined;
    return itemBomMatches[itemId]?.id;
  };

  // Auto-select all items when CPO changes
  useEffect(() => {
    if (hasCpoItems) {
      setSelectedItemIds(new Set(cpoItems.map((item: any) => item.id)));
    } else {
      setSelectedItemIds(new Set());
    }
    setItemBomOverrides({});
  }, [cpoId, hasCpoItems]);

  // Auto-fill from BOM when selected (only for manual mode)
  useEffect(() => {
    if (bomId && bomId !== "none" && boms) {
      const bom = boms.find((b) => b.id === bomId);
      if (bom && !hasCpoItems) {
        if (bom.product_name) setProductName(bom.product_name);
        if (bom.style_no) setStyleNo(bom.style_no);
      }
    }
  }, [bomId, boms, hasCpoItems]);

  const resetForm = () => {
    setSectorId(""); setProductName(""); setStyleNo(""); setTargetQty("");
    setCpoId(""); setBomId(""); setStartDate(""); setDueDate(""); setNotes("");
    setSelectedItemIds(new Set());
    setItemBomOverrides({});
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedItemIds.size === cpoItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(cpoItems.map((item: any) => item.id)));
    }
  };

  const stages = (stageTemplates || []).map((st) => ({
    stage_name: st.stage_name,
    sequence_order: st.sequence_order,
    stage_template_id: st.id,
  }));

  const handleSubmit = async () => {
    if (!sectorId) return;

    if (hasCpoItems && selectedItemIds.size > 0) {
      // Batch create from CPO items with per-item BOM
      const items = cpoItems
        .filter((item: any) => selectedItemIds.has(item.id))
        .map((item: any) => ({
          cpo_item_id: item.id,
          item_name: item.item_name,
          style_no: item.style_no || undefined,
          target_qty: item.quantity_ordered,
          bom_id: getItemBomId(item.id),
        }));

      await batchCreateMutation.mutateAsync({
        sector_id: sectorId,
        cpo_id: cpoId,
        bom_id: bomId && bomId !== "none" ? bomId : undefined,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        stages,
        items,
      });
    } else {
      // Single order (manual entry)
      if (!productName || !targetQty) return;
      await createMutation.mutateAsync({
        sector_id: sectorId,
        product_name: productName,
        style_no: styleNo || undefined,
        target_qty: parseInt(targetQty),
        cpo_id: cpoId && cpoId !== "none" ? cpoId : undefined,
        bom_id: bomId && bomId !== "none" ? bomId : undefined,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        stages,
      });
    }
    resetForm();
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || batchCreateMutation.isPending;
  const canSubmit = sectorId && (hasCpoItems ? selectedItemIds.size > 0 : productName && targetQty);

  // Count how many selected items have a BOM linked
  const linkedBomCount = hasCpoItems
    ? Array.from(selectedItemIds).filter((id) => getItemBomId(id)).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Production Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Sector *</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
              <SelectContent>
                {sectors?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Link to Customer PO (optional)</Label>
            <Select value={cpoId} onValueChange={setCpoId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {cpos?.map((c) => <SelectItem key={c.id} value={c.id}>{c.cpo_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* CPO Items Checklist with BOM column */}
          {hasCpoItems && (
            <div>
              <Label className="text-sm">Select CPO Items to Produce</Label>
              <div className="rounded-md border mt-1 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedItemIds.size === cpoItems.length && cpoItems.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Style No.</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>BOM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cpoItems.map((item: any) => {
                      const autoMatch = itemBomMatches[item.id];
                      const override = itemBomOverrides[item.id];
                      const effectiveBomId = getItemBomId(item.id);
                      const effectiveBom = effectiveBomId
                        ? boms?.find((b) => b.id === effectiveBomId)
                        : null;

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItemIds.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell>{item.style_no || "—"}</TableCell>
                          <TableCell>{item.color || "—"}</TableCell>
                          <TableCell>{item.size || "—"}</TableCell>
                          <TableCell className="text-right">{item.quantity_ordered?.toLocaleString()}</TableCell>
                          <TableCell>
                            <Select
                              value={override || (autoMatch?.id ? autoMatch.id : "none")}
                              onValueChange={(val) =>
                                setItemBomOverrides((prev) => ({ ...prev, [item.id]: val }))
                              }
                            >
                              <SelectTrigger className="h-8 w-[160px] text-xs">
                                <SelectValue placeholder="No BOM" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No BOM</SelectItem>
                                {boms?.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.bom_number}
                                    {b.id === autoMatch?.id ? " ✓" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {autoMatch && !override && (
                              <span className="text-[10px] text-muted-foreground">auto-linked</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedItemIds.size} of {cpoItems.length} items selected
                {linkedBomCount > 0 && ` · ${linkedBomCount} with BOM linked`}
                {" — one production order per item"}
              </p>
            </div>
          )}

          {/* Global BOM dropdown only when no CPO items */}
          {!hasCpoItems && (
            <div>
              <Label>Link to BOM (optional)</Label>
              <Select value={bomId} onValueChange={setBomId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {boms?.map((b) => <SelectItem key={b.id} value={b.id}>{b.bom_number} — {b.product_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Manual entry fields (only when no CPO items) */}
          {!hasCpoItems && (
            <>
              <div>
                <Label>Product Name *</Label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Style No.</Label>
                  <Input value={styleNo} onChange={(e) => setStyleNo(e.target.value)} />
                </div>
                <div>
                  <Label>Target Qty *</Label>
                  <Input type="number" value={targetQty} onChange={(e) => setTargetQty(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {sectorId && stageTemplates && stageTemplates.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground">Stages (auto-populated from sector)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {stageTemplates.map((st, i) => (
                  <span key={st.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {i + 1}. {st.stage_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hasCpoItems && selectedItemIds.size > 0
                ? `Create ${selectedItemIds.size} Order${selectedItemIds.size > 1 ? "s" : ""}`
                : "Create Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
