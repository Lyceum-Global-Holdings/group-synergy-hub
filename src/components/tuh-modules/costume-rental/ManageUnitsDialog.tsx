import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import AssetQRCode from "@/components/warehouse/AssetQRCode";
import { useCostumeUnits } from "@/hooks/useCostumeUnits";
import type { Costume, CostumeUnit, UnitCondition, UnitStatus } from "@/types/costumeRental";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costume: Costume | null;
}

const STATUS_VARIANT: Record<UnitStatus, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  reserved: "secondary",
  out: "secondary",
  maintenance: "outline",
  retired: "destructive",
};

export function ManageUnitsDialog({ open, onOpenChange, costume }: Props) {
  const { units, createUnit, deleteUnit } = useCostumeUnits(costume?.id);
  const [condition, setCondition] = useState<UnitCondition>("good");

  const addUnit = async () => {
    if (!costume) return;
    await createUnit.mutateAsync({
      costume_id: costume.id,
      condition,
      company_id: costume.company_id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Units — {costume?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-3 rounded-lg border p-3">
          <div className="space-y-1">
            <Label>New unit condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as UnitCondition)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["new", "good", "fair", "needs_repair", "retired"] as UnitCondition[]).map((c) => (
                  <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addUnit} disabled={createUnit.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Add unit
          </Button>
          <span className="ml-auto text-sm text-muted-foreground">{units.length} unit(s)</span>
        </div>

        <div className="space-y-1">
          {units.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No physical units yet. Add one above.</p>
          )}
          {units.map((u: CostumeUnit) => (
            <div key={u.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
              <span className="font-mono">{u.unit_code}</span>
              <Badge variant={STATUS_VARIANT[u.status]} className="capitalize">{u.status}</Badge>
              <span className="text-muted-foreground capitalize">{u.condition.replace("_", " ")}</span>
              <div className="ml-auto flex items-center gap-2">
                <AssetQRCode assetId={u.id} assetName={costume?.name ?? "Costume"} assetIdentifier={u.unit_code} />
                <Button
                  variant="ghost" size="sm" className="text-destructive"
                  onClick={() => deleteUnit.mutate(u.id)}
                  disabled={u.status === "out"}
                  title={u.status === "out" ? "Unit is checked out" : "Remove unit"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
