import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToolCalibrations, type ToolCalibrationResult } from "@/hooks/useToolCalibrations";
import type { ToolUnit } from "@/types/toolUnits";

interface Props {
  unit: ToolUnit | null;
  toolName?: string;
  defaultIntervalMonths?: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const today = () => new Date().toISOString().split("T")[0];

export function RecordCalibrationDialog({ unit, toolName, defaultIntervalMonths, open, onOpenChange }: Props) {
  const { record } = useToolCalibrations(unit?.id);
  const [date, setDate] = useState(today());
  const [result, setResult] = useState<ToolCalibrationResult>("pass");
  const [provider, setProvider] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [certNo, setCertNo] = useState("");
  const [interval, setInterval] = useState<string>("");
  const [cost, setCost] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setDate(today());
      setResult("pass");
      setProvider(""); setPerformedBy(""); setCertNo("");
      setInterval(defaultIntervalMonths != null ? String(defaultIntervalMonths) : "");
      setCost(""); setNotes("");
    }
  }, [open, defaultIntervalMonths]);

  const submit = async () => {
    if (!unit) return;
    await record.mutateAsync({
      unit_id: unit.id,
      calibration_date: date,
      result,
      provider: provider.trim() || undefined,
      performed_by: performedBy.trim() || undefined,
      certificate_number: certNo.trim() || undefined,
      interval_months: interval ? parseInt(interval, 10) : null,
      cost: cost ? parseFloat(cost) : null,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record calibration</DialogTitle>
          <DialogDescription>
            {toolName ? `${toolName} · ` : ""}<span className="font-mono">{unit?.unit_code}</span>. ISO/IEC 17025 — sets the next due date and quarantines on failure.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Calibration date *</Label>
            <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Result *</Label>
            <Select value={result} onValueChange={(v) => setResult(v as ToolCalibrationResult)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="adjusted">Adjusted (pass)</SelectItem>
                <SelectItem value="limited">Limited</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Provider / lab</Label>
            <Input className="h-9" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. CalLab Inc" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Performed by</Label>
            <Input className="h-9" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Technician" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Certificate #</Label>
            <Input className="h-9" value={certNo} onChange={(e) => setCertNo(e.target.value)} placeholder="CERT-…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Interval (months)</Label>
            <Input type="number" min="1" className="h-9" value={interval} onChange={(e) => setInterval(e.target.value)} placeholder="e.g. 12" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Cost</Label>
            <Input type="number" min="0" className="h-9" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} className="min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={record.isPending}>
            {record.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
