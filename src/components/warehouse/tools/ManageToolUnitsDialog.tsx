import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, QrCode, History, ChevronDown, ChevronRight, Gauge, Wrench } from "lucide-react";
import { useToolUnits, useToolUnitEvents } from "@/hooks/useToolUnits";
import { RecordCalibrationDialog } from "./RecordCalibrationDialog";
import { RecordMaintenanceDialog } from "./RecordMaintenanceDialog";
import { generateBulkQRCodePdf, downloadBulkQRCodePdf } from "@/utils/bulkQRCodePdf";
import { toast } from "@/hooks/use-toast";
import {
  TOOL_UNIT_STATUS_LABELS, TOOL_UNIT_CONDITION_LABELS,
  type ToolUnit, type ToolUnitStatus, type ToolUnitCondition,
} from "@/types/toolUnits";
import type { WarehouseTool } from "@/types/toolManagement";
import { useFormatDate } from "@/lib/formatters";

interface Props {
  tool: WarehouseTool | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const STATUS_TONE: Record<ToolUnitStatus, string> = {
  in_service: "bg-success/15 text-success",
  issued: "bg-info/15 text-info",
  in_repair: "bg-warning/15 text-warning",
  in_calibration: "bg-warning/15 text-warning",
  retired: "bg-muted text-muted-foreground",
  lost: "bg-destructive/15 text-destructive",
};

export function ManageToolUnitsDialog({ tool, open, onOpenChange }: Props) {
  const fmt = useFormatDate();
  const { units, isLoading, generateUnits, setStatus } = useToolUnits(tool?.id);
  const [genCount, setGenCount] = useState("1");
  const [serial, setSerial] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [calUnit, setCalUnit] = useState<ToolUnit | null>(null);
  const [mntUnit, setMntUnit] = useState<ToolUnit | null>(null);

  const capacity = Number(tool?.total_quantity ?? 0);
  const remaining = Math.max(0, capacity - units.length);

  const handleGenerate = async () => {
    if (!tool) return;
    if (remaining <= 0) {
      toast({
        title: "No slots available",
        description: `All ${capacity} units of this tool are already registered. Increase the tool quantity first.`,
        variant: "destructive",
      });
      return;
    }
    const requested = Math.max(1, parseInt(genCount, 10) || 1);
    const n = Math.min(requested, remaining);
    if (n < requested) {
      toast({ title: "Capped to available slots", description: `Only ${remaining} unit(s) can be registered.` });
    }
    await generateUnits.mutateAsync({
      count: n,
      base: { tool_id: tool.id, company_id: tool.company_id, serial_number: serial.trim() || undefined },
    });
    setSerial("");
    setGenCount("1");
  };

  const handlePrintAll = async () => {
    if (!tool || units.length === 0) return;
    try {
      setPrinting(true);
      const blob = await generateBulkQRCodePdf(
        units.map((u) => ({
          id: u.id,
          name: `${tool.name} · ${u.unit_code}`,
          asset_id: u.unit_code,
          serial_number: u.serial_number,
          asset_tag: u.asset_tag,
        })),
      );
      downloadBulkQRCodePdf(blob, `${tool.tool_code}-unit-labels.pdf`);
    } catch (e: any) {
      toast({ title: "QR export failed", description: e.message, variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Units — {tool?.name}</DialogTitle>
          <DialogDescription>
            Serialized units of <strong>{tool?.tool_code}</strong>. Each unit has its own code, QR tag, and full history.
          </DialogDescription>
        </DialogHeader>

        {/* Register units */}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="space-y-1">
            <Label className="text-xs">Quantity</Label>
            <Input
              type="number"
              min="1"
              max={remaining || undefined}
              className="w-24 h-9"
              value={genCount}
              onChange={(e) => setGenCount(e.target.value)}
              disabled={remaining <= 0}
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label className="text-xs">Serial number (optional, single unit)</Label>
            <Input className="h-9" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. SN-4471-A" />
          </div>
          <Button onClick={handleGenerate} disabled={generateUnits.isPending || remaining <= 0} className="h-9">
            {generateUnits.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Register units
          </Button>
          <Button variant="outline" className="h-9" onClick={handlePrintAll} disabled={printing || units.length === 0}>
            {printing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <QrCode className="h-4 w-4 mr-1" />}
            Print QR labels
          </Button>
          <span className="text-xs text-muted-foreground ml-auto self-center">
            {remaining > 0
              ? <><span className="font-medium text-foreground">{remaining}</span> of {capacity} slot(s) available to register</>
              : <>All {capacity} unit(s) registered</>}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading units…
          </div>
        ) : units.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No units yet. Register one or more physical units above.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Unit</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Cal. due</TableHead>
                  <TableHead>Maint. due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => (
                  <UnitRow
                    key={u.id}
                    unit={u}
                    expanded={expanded === u.id}
                    onToggle={() => setExpanded(expanded === u.id ? null : u.id)}
                    onStatus={(status) => setStatus.mutate({ id: u.id, status })}
                    onCondition={(condition) => setStatus.mutate({ id: u.id, condition })}
                    onCalibrate={() => setCalUnit(u)}
                    onService={() => setMntUnit(u)}
                    fmt={fmt}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <RecordCalibrationDialog
          unit={calUnit}
          toolName={tool?.name}
          defaultIntervalMonths={(tool as any)?.calibration_interval_months ?? null}
          open={!!calUnit}
          onOpenChange={(o) => { if (!o) setCalUnit(null); }}
        />
        <RecordMaintenanceDialog
          unit={mntUnit}
          toolName={tool?.name}
          defaultIntervalMonths={(tool as any)?.maintenance_interval_months ?? null}
          open={!!mntUnit}
          onOpenChange={(o) => { if (!o) setMntUnit(null); }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Due-date tone: overdue = red, within 30d = amber. */
function dueTone(d?: string | null): string {
  if (!d) return "text-muted-foreground";
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "text-destructive font-medium";
  if (days <= 30) return "text-warning font-medium";
  return "";
}

function UnitRow({
  unit, expanded, onToggle, onStatus, onCondition, onCalibrate, onService, fmt,
}: {
  unit: ToolUnit;
  expanded: boolean;
  onToggle: () => void;
  onStatus: (s: ToolUnitStatus) => void;
  onCondition: (c: ToolUnitCondition) => void;
  onCalibrate: () => void;
  onService: () => void;
  fmt: (d?: string | null, f?: string) => string;
}) {
  return (
    <>
      <TableRow>
        <TableCell>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} aria-label="History">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-mono text-xs font-medium">{unit.unit_code}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{unit.serial_number || "—"}</TableCell>
        <TableCell>
          <Select value={unit.status} onValueChange={(v) => onStatus(v as ToolUnitStatus)}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue>
                <Badge variant="outline" className={STATUS_TONE[unit.status]}>{TOOL_UNIT_STATUS_LABELS[unit.status]}</Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TOOL_UNIT_STATUS_LABELS) as ToolUnitStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{TOOL_UNIT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select value={unit.condition} onValueChange={(v) => onCondition(v as ToolUnitCondition)}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TOOL_UNIT_CONDITION_LABELS) as ToolUnitCondition[]).map((cn) => (
                <SelectItem key={cn} value={cn}>{TOOL_UNIT_CONDITION_LABELS[cn]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className={`text-xs ${dueTone(unit.next_calibration_due)}`}>{unit.next_calibration_due ? fmt(unit.next_calibration_due) : "—"}</TableCell>
        <TableCell className={`text-xs ${dueTone(unit.next_maintenance_due)}`}>{unit.next_maintenance_due ? fmt(unit.next_maintenance_due) : "—"}</TableCell>
        <TableCell className="text-right whitespace-nowrap">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onCalibrate} title="Record calibration">
            <Gauge className="h-3.5 w-3.5 mr-1" /> Calibrate
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onService} title="Record maintenance">
            <Wrench className="h-3.5 w-3.5 mr-1" /> Service
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30">
            <UnitTimeline unitId={unit.id} fmt={fmt} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function UnitTimeline({ unitId, fmt }: { unitId: string; fmt: (d?: string | null, f?: string) => string }) {
  const { data: events = [], isLoading } = useToolUnitEvents(unitId);
  if (isLoading) return <div className="py-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading history…</div>;
  if (events.length === 0) return <div className="py-3 text-xs text-muted-foreground">No history.</div>;
  return (
    <div className="py-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><History className="h-3.5 w-3.5" /> History</div>
      {events.map((e) => (
        <div key={e.id} className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground w-36 shrink-0">{fmt(e.created_at, "dd MMM yyyy HH:mm")}</span>
          <span className="font-medium capitalize">{e.event_type.replace(/_/g, " ")}</span>
          {(e.from_value || e.to_value) && (
            <span className="text-muted-foreground">{e.from_value ? `${e.from_value} → ` : ""}{e.to_value}</span>
          )}
          {e.notes && <span className="text-muted-foreground">· {e.notes}</span>}
        </div>
      ))}
    </div>
  );
}
