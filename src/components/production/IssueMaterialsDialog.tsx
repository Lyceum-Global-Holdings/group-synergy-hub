import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useIssueStageMaterials } from "@/hooks/useProduction";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: any;          // has id + production_stage_costs
  companyId?: string;
}

export default function IssueMaterialsDialog({ open, onOpenChange, stage, companyId }: Props) {
  const { locations = [] } = useWarehouseLocations();
  const issue = useIssueStageMaterials();
  const [locationId, setLocationId] = useState<string>("");

  const companyLocations = useMemo(
    () => (companyId ? locations.filter((l: any) => l.company_id === companyId) : locations),
    [locations, companyId],
  );

  useEffect(() => { if (open) setLocationId(""); }, [open]);

  // BOM-linked cost lines that still have quantity left to issue.
  const pending = (stage?.production_stage_costs || []).filter(
    (c: any) => c.bom_item_id && Number(c.quantity_used || 0) > Number(c.consumed_qty || 0),
  );

  const confirm = async () => {
    if (!locationId) return;
    try {
      await issue.mutateAsync({ stage_id: stage.id, location_id: locationId });
      onOpenChange(false);
    } catch { /* toast in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Issue materials — {stage?.stage_name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Deducts the BOM-linked materials of this stage from the chosen location (FIFO across its bins). Already-issued lines are skipped.
        </p>

        <div className="space-y-1">
          <Label>Source location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger><SelectValue placeholder="Select location to deduct from" /></SelectTrigger>
            <SelectContent>
              {companyLocations.length === 0 && <SelectItem value="__none" disabled>No locations</SelectItem>}
              {companyLocations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Materials to issue</Label>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No BOM-linked materials remaining to issue for this stage.</p>
          ) : (
            <div className="space-y-1">
              {pending.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{c.item_name}</span>
                  <Badge variant="secondary">
                    {(Number(c.quantity_used || 0) - Number(c.consumed_qty || 0)).toLocaleString()} {c.unit_of_measure || "pcs"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={!locationId || pending.length === 0 || issue.isPending}>
            {issue.isPending ? "Issuing…" : "Issue materials"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
