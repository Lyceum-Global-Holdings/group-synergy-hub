import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Boxes, Pencil, SlidersHorizontal, Wrench, MapPin, Tag, Gauge, ShieldCheck } from "lucide-react";
import type { WarehouseTool } from "@/types/toolManagement";

interface Props {
  tool: WarehouseTool | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onManageUnits?: (t: WarehouseTool) => void;
  onEdit?: (t: WarehouseTool) => void;
  onAdjust?: (t: WarehouseTool) => void;
}

export function ToolDetailsDialog({ tool, open, onOpenChange, onManageUnits, onEdit, onAdjust }: Props) {
  if (!tool) return null;
  const t = tool as any;
  const available = Number(tool.available_quantity ?? 0);
  const issued = Number(tool.issued_quantity ?? 0);
  const total = Number(tool.total_quantity ?? 0);
  const act = (fn?: (x: WarehouseTool) => void) => { onOpenChange(false); fn?.(tool); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tool.name}
            {t.is_serialized && <Badge variant="outline" className="bg-info/10 text-info border-info/20">Serialized</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4">
          {/* Image */}
          <div className="aspect-[4/3] sm:aspect-square rounded-lg border bg-muted overflow-hidden flex items-center justify-center">
            {tool.image_url ? (
              <img src={tool.image_url} alt={tool.name} className="w-full h-full object-cover" />
            ) : (
              <Wrench className="h-12 w-12 text-muted-foreground/30" />
            )}
          </div>

          {/* Facts */}
          <div className="space-y-3">
            <div className="font-mono text-xs text-muted-foreground">{tool.tool_code}</div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total" value={total} />
              <Stat label="Available" value={available} tone={available > 0 ? "success" : "destructive"} />
              <Stat label="Issued" value={issued} tone={issued > 0 ? "info" : undefined} />
            </div>
            <Separator />
            <dl className="space-y-1.5 text-sm">
              <Row icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={tool.category?.name || "—"} />
              <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={tool.location?.name || "—"} />
              <Row icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Condition" value={<span className="capitalize">{tool.condition || "—"}</span>} />
              {tool.unit_cost != null && <Row icon={<Tag className="h-3.5 w-3.5" />} label="Unit cost" value={String(tool.unit_cost)} />}
              {t.calibration_required && (
                <Row icon={<Gauge className="h-3.5 w-3.5" />} label="Calibration"
                     value={t.calibration_interval_months ? `Every ${t.calibration_interval_months} mo` : "Required"} />
              )}
              {t.maintenance_interval_months && (
                <Row icon={<Wrench className="h-3.5 w-3.5" />} label="Maintenance" value={`Every ${t.maintenance_interval_months} mo`} />
              )}
            </dl>
          </div>
        </div>

        {tool.notes && (
          <>
            <Separator />
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Notes</div>
              <p className="text-sm">{tool.notes}</p>
            </div>
          </>
        )}

        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => act(onManageUnits)}>
            <Boxes className="h-4 w-4 mr-2" /> Manage units, QR & service
          </Button>
          <Button variant="outline" onClick={() => act(onEdit)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" onClick={() => act(onAdjust)}>
            <SlidersHorizontal className="h-4 w-4 mr-2" /> Adjust quantity
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" | "info" }) {
  const col = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : tone === "info" ? "text-info" : "text-foreground";
  return (
    <div className="rounded-md border p-2 text-center">
      <div className={`text-xl font-bold tabular-nums ${col}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
