import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCostumeCart } from "@/contexts/CostumeCartContext";
import { formatCurrency } from "@/lib/utils";
import type { Costume } from "@/types/costumeRental";
import { costumeSizeOptions, sizeLabel } from "./sizeUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costume: Costume | null;
}

export function AddToBucketDialog({ open, onOpenChange, costume }: Props) {
  const cart = useCostumeCart();
  const sizes = useMemo(() => costumeSizeOptions(costume), [costume]);
  const hasSizes = sizes.length > 1 || (sizes.length === 1 && sizes[0].size !== "");

  // Physical units that can be reserved individually as a "preferred unit".
  const availableUnits = useMemo(
    () => (costume?.units ?? []).filter((u) => u.status === "available"),
    [costume],
  );

  const NO_UNIT = "__none__";
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [unitId, setUnitId] = useState<string>(NO_UNIT); // NO_UNIT = add by size + quantity

  useEffect(() => {
    if (open) {
      setSize(sizes[0]?.size ?? "");
      setQty(1);
      setUnitId(NO_UNIT);
    }
  }, [open, costume]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!costume) return null;
  const selected = sizes.find((s) => s.size === size);
  const chosenUnit = availableUnits.find((u) => u.id === unitId);

  const confirm = () => {
    if (chosenUnit) {
      if (cart.hasUnit(chosenUnit.id)) {
        toast.info(`${chosenUnit.unit_code} is already in the bucket`);
        onOpenChange(false);
        return;
      }
      cart.addUnit(costume.id, chosenUnit.id, chosenUnit.unit_code, chosenUnit.size ?? "");
      toast.success(`Added ${costume.name} · ${chosenUnit.unit_code} to the bucket`);
      onOpenChange(false);
      return;
    }
    cart.add(costume.id, size, qty);
    toast.success(`Added ${qty} × ${costume.name}${size ? ` (${size})` : ""} to the bucket`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add to bucket</DialogTitle></DialogHeader>

        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
            {costume.image_url && <img src={costume.image_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{costume.name}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(costume.daily_rate)}/day · deposit {formatCurrency(costume.security_deposit)}</p>
          </div>
        </div>

        {availableUnits.length > 0 && (
          <div className="space-y-1">
            <Label>Specific unit <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_UNIT}>Any unit — choose by size &amp; quantity</SelectItem>
                {availableUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.unit_code}{u.size ? ` · ${sizeLabel(u.size)}` : ""} · {u.condition}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chosenUnit && (
              <p className="text-xs text-muted-foreground">
                Reserves <span className="font-medium">{chosenUnit.unit_code}</span> as the preferred unit — confirmed at checkout.
              </p>
            )}
          </div>
        )}

        {!chosenUnit && hasSizes && (
          <div className="space-y-1">
            <Label>Size</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sizes.map((s) => (
                  <SelectItem key={s.size || "_one"} value={s.size}>
                    {sizeLabel(s.size)} — {s.available} available
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!chosenUnit && (
          <div className="space-y-1">
            <Label>Quantity</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            {selected && (
              <p className="text-xs text-muted-foreground">{selected.available} unit(s) currently available{size ? ` in size ${size}` : ""}.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm}><ShoppingCart className="h-4 w-4 mr-2" /> Add to bucket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
