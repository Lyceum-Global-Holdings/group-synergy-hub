import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToolMaintenance, type ToolMaintenanceType } from "@/hooks/useToolMaintenance";
import type { ToolUnit } from "@/types/toolUnits";

interface Props {
  unit: ToolUnit | null;
  toolName?: string;
  defaultIntervalMonths?: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const today = () => new Date().toISOString().split("T")[0];

export function RecordMaintenanceDialog({ unit, toolName, defaultIntervalMonths, open, onOpenChange }: Props) {
  const { record } = useToolMaintenance(unit?.id);
  const [date, setDate] = useState(today());
  const [type, setType] = useState<ToolMaintenanceType>("preventive");
  const [provider, setProvider] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [cost, setCost] = useState("");
  const [interval, setInterval] = useState("");
  const [oos, setOos] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setDate(today()); setType("preventive"); setProvider(""); setPerformedBy("");
      setCost(""); setInterval(defaultIntervalMonths != null ? String(defaultIntervalMonths) : "");
      setOos(false); setDescription("");
    }
  }, [open, defaultIntervalMonths]);

  const submit = async () => {
    if (!unit) return;
    await record.mutateAsync({
      unit_id: unit.id,
      maintenance_type: type,
      maintenance_date: date,
      provider: provider.trim() || undefined,
      performed_by: performedBy.trim() || undefined,
      cost: cost ? parseFloat(cost) : null,
      interval_months: interval ? parseInt(interval, 10) : null,
      out_of_service: oos,
      description: description.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record maintenance</DialogTitle>
          <DialogDescription>
            {toolName ? `${toolName} · ` : ""}<span className="font-mono">{unit?.unit_code}</span>. ISO 55000 — sets the next service due date and in-service / in-repair status.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Date *</Label>
            <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as ToolMaintenanceType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="preventive">Preventive</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="overhaul">Overhaul</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Input className="h-9" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Service provider" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Performed by</Label>
            <Input className="h-9" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Technician" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Interval (months)</Label>
            <Input type="number" min="1" className="h-9" value={interval} onChange={(e) => setInterval(e.target.value)} placeholder="e.g. 6" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cost</Label>
            <Input type="number" min="0" className="h-9" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label className="text-xs">Keep out of service</Label>
              <p className="text-[11px] text-muted-foreground">Marks the unit in-repair (unavailable) until returned to service.</p>
            </div>
            <Switch checked={oos} onCheckedChange={setOos} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} className="min-h-0" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Work performed / fault" />
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
