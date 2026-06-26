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

  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (open) {
      setSize(sizes[0]?.size ?? "");
      setQty(1);
    }
  }, [open, costume]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!costume) return null;
  const selected = sizes.find((s) => s.size === size);

  const confirm = () => {
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

        {hasSizes && (
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

        <div className="space-y-1">
          <Label>Quantity</Label>
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          {selected && (
            <p className="text-xs text-muted-foreground">{selected.available} unit(s) currently available{size ? ` in size ${size}` : ""}.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm}><ShoppingCart className="h-4 w-4 mr-2" /> Add to bucket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
