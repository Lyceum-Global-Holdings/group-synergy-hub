import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useProductionSectors, useStageTemplates, useCreateProductionOrder, useBOMs, useCPOs } from "@/hooks/useProduction";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateProductionOrderDialog({ open, onOpenChange }: Props) {
  const { data: sectors } = useProductionSectors();
  const { data: boms } = useBOMs();
  const { data: cpos } = useCPOs();
  const createMutation = useCreateProductionOrder();

  const [sectorId, setSectorId] = useState("");
  const [productName, setProductName] = useState("");
  const [styleNo, setStyleNo] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [cpoId, setCpoId] = useState("");
  const [bomId, setBomId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: stageTemplates } = useStageTemplates(sectorId || undefined);

  // Auto-fill from BOM when selected
  useEffect(() => {
    if (bomId && bomId !== "none" && boms) {
      const bom = boms.find((b) => b.id === bomId);
      if (bom) {
        if (bom.product_name) setProductName(bom.product_name);
        if (bom.style_no) setStyleNo(bom.style_no);
      }
    }
  }, [bomId, boms]);

  const resetForm = () => {
    setSectorId(""); setProductName(""); setStyleNo(""); setTargetQty("");
    setCpoId(""); setBomId(""); setStartDate(""); setDueDate(""); setNotes("");
  };

  const handleSubmit = async () => {
    if (!sectorId || !productName || !targetQty) return;

    const stages = (stageTemplates || []).map((st) => ({
      stage_name: st.stage_name,
      sequence_order: st.sequence_order,
      stage_template_id: st.id,
    }));

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
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <Button onClick={handleSubmit} disabled={createMutation.isPending || !sectorId || !productName || !targetQty}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
