import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRentalOrders } from "@/hooks/useRentalOrders";
import type { RentalOrder, RentalOrderItem, CostumeUnit, UnitCondition } from "@/types/costumeRental";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: RentalOrder;
  companyId?: string;
}

// One slot per booked unit: which physical unit + condition out.
interface Slot { order_item_id: string; unit_id: string; condition_out: UnitCondition; }

const CONDITIONS: UnitCondition[] = ["new", "good", "fair", "needs_repair"];

export function CheckoutDialog({ open, onOpenChange, order, companyId }: Props) {
  const { checkoutOrder, isMutating } = useRentalOrders(companyId);
  const items = order.items ?? [];
  const costumeIds = useMemo(() => Array.from(new Set(items.map((i) => i.costume_id))), [items]);

  const { data: availableUnits = [] } = useQuery({
    queryKey: ["available-units", order.id, costumeIds],
    enabled: open && costumeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rental_costume_units")
        .select("id, unit_code, costume_id, size, condition, status")
        .in("costume_id", costumeIds)
        .eq("status", "available");
      if (error) throw error;
      return (data ?? []) as (CostumeUnit & { costume_id: string })[];
    },
  });

  // Build empty slots = sum of quantities.
  const [slots, setSlots] = useState<Slot[]>([]);
  useEffect(() => {
    if (open) {
      const s: Slot[] = [];
      items.forEach((it: RentalOrderItem) => {
        for (let k = 0; k < it.quantity; k++) s.push({ order_item_id: it.id, unit_id: "", condition_out: "good" });
      });
      setSlots(s);
    }
  }, [open, order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select each line's preferred unit once availability loads, if it's still
  // available and not already claimed by another slot.
  useEffect(() => {
    if (!open || availableUnits.length === 0) return;
    const availIds = new Set(availableUnits.map((u) => u.id));
    setSlots((prev) => {
      const claimed = new Set(prev.map((s) => s.unit_id).filter(Boolean));
      let changed = false;
      const next = prev.map((s) => {
        if (s.unit_id) return s;
        const pref = items.find((it) => it.id === s.order_item_id)?.preferred_unit_id;
        if (pref && availIds.has(pref) && !claimed.has(pref)) {
          claimed.add(pref); changed = true;
          return { ...s, unit_id: pref };
        }
        return s;
      });
      return changed ? next : prev;
    });
  }, [open, availableUnits, items]);

  const chosen = new Set(slots.map((s) => s.unit_id).filter(Boolean));
  const unitsFor = (costumeId: string, size: string, currentUnitId: string) =>
    availableUnits.filter((u) =>
      u.costume_id === costumeId && (u.size ?? "") === size && (!chosen.has(u.id) || u.id === currentUnitId));

  const setSlot = (idx: number, patch: Partial<Slot>) =>
    setSlots((p) => p.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const confirm = async () => {
    if (slots.some((s) => !s.unit_id)) { toast.error("Assign a unit to every slot"); return; }
    try {
      await checkoutOrder(order.id, slots);
      onOpenChange(false);
    } catch { /* toast in hook */ }
  };

  let slotIdx = -1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Check out — {order.rental_number}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Assign a physical unit to each booked item and record its condition.</p>

        <div className="space-y-4">
          {items.map((it: RentalOrderItem) => (
            <div key={it.id} className="rounded-lg border p-3 space-y-2">
              <p className="font-medium text-sm">
                {it.costume?.name}
                {it.size ? <span className="text-xs text-muted-foreground"> · size {it.size}</span> : null}
                <span className="text-xs text-muted-foreground"> × {it.quantity}</span>
              </p>
              {Array.from({ length: it.quantity }).map((_, k) => {
                slotIdx++;
                const idx = slotIdx;
                const slot = slots[idx];
                if (!slot) return null;
                const opts = unitsFor(it.costume_id, it.size, slot.unit_id);
                return (
                  <div key={k} className="flex items-center gap-2">
                    <Select value={slot.unit_id} onValueChange={(v) => setSlot(idx, { unit_id: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>
                        {opts.length === 0 && <SelectItem value="__none" disabled>No available units</SelectItem>}
                        {opts.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Condition out</Label>
                      <Select value={slot.condition_out} onValueChange={(v) => setSlot(idx, { condition_out: v as UnitCondition })}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={isMutating}>{isMutating ? "Checking out…" : "Confirm checkout"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
