import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRentalOrders } from "@/hooks/useRentalOrders";
import { formatCurrency } from "@/lib/utils";
import type { RentalOrder, UnitCondition } from "@/types/costumeRental";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: RentalOrder;
  companyId?: string;
}

interface ReturnRow { assignment_id: string; unit_code: string; condition_in: UnitCondition; damage_notes: string; }

const CONDITIONS: UnitCondition[] = ["new", "good", "fair", "needs_repair", "retired"];

const overdueDays = (due: string) =>
  Math.max(0, Math.round((Date.now() - new Date(due).getTime()) / 86400000));

export function ReturnDialog({ open, onOpenChange, order, companyId }: Props) {
  const { returnOrder, isMutating } = useRentalOrders(companyId);
  const items = order.items ?? [];
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [damageFee, setDamageFee] = useState("0");

  // Assignments live in the Phase C table; fetch them only when returning.
  const { data: assignments = [] } = useQuery({
    queryKey: ["order-assignments", order.id],
    enabled: open,
    queryFn: async () => {
      const itemIds = items.map((i) => i.id);
      if (itemIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("rental_unit_assignments")
        .select("id, condition_out, returned, unit:rental_costume_units(unit_code)")
        .in("order_item_id", itemIds)
        .eq("returned", false);
      if (error) throw error;
      return (data ?? []) as { id: string; condition_out: UnitCondition; unit: { unit_code: string } | null }[];
    },
  });

  useEffect(() => {
    if (open) {
      setRows(assignments.map((a) => ({
        assignment_id: a.id,
        unit_code: a.unit?.unit_code ?? "unit",
        condition_in: a.condition_out,
        damage_notes: "",
      })));
      setDamageFee("0");
    }
  }, [open, order.id, assignments]); // eslint-disable-line react-hooks/exhaustive-deps

  const dailyTotal = useMemo(
    () => items.reduce((s, it) => s + it.daily_rate * it.quantity, 0), [items]);
  const od = overdueDays(order.due_date);
  const lateFee = od * dailyTotal;
  const refund = Math.max(0, order.deposit_total - lateFee - (Number(damageFee) || 0));

  const setRow = (i: number, patch: Partial<ReturnRow>) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const confirm = async () => {
    try {
      await returnOrder(
        order.id,
        rows.map((r) => ({ assignment_id: r.assignment_id, condition_in: r.condition_in, damage_notes: r.damage_notes })),
        Number(damageFee) || 0,
      );
      onOpenChange(false);
    } catch { /* toast in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Process return — {order.rental_number}</DialogTitle></DialogHeader>

        <div className="space-y-2">
          <Label>Returned units & condition</Label>
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No assigned units found.</p>}
          {rows.map((r, i) => (
            <div key={r.assignment_id} className="flex items-center gap-2">
              <span className="font-mono text-sm w-32 truncate">{r.unit_code}</span>
              <Select value={r.condition_in} onValueChange={(v) => setRow(i, { condition_in: v as UnitCondition })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="flex-1" placeholder="Damage notes (optional)" value={r.damage_notes}
                onChange={(e) => setRow(i, { damage_notes: e.target.value })} />
            </div>
          ))}
        </div>

        <div className="space-y-1 max-w-xs">
          <Label>Damage fee (LKR)</Label>
          <Input type="number" min="0" step="0.01" value={damageFee} onChange={(e) => setDamageFee(e.target.value)} />
        </div>

        <div className="rounded-md border p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Security deposit held</span><span>{formatCurrency(order.deposit_total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Late fee ({od} day{od === 1 ? "" : "s"} × {formatCurrency(dailyTotal)})</span><span>−{formatCurrency(lateFee)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Damage fee</span><span>−{formatCurrency(Number(damageFee) || 0)}</span></div>
          <div className="flex justify-between font-medium border-t pt-1"><span>Deposit refund</span><span>{formatCurrency(refund)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={isMutating}>{isMutating ? "Processing…" : "Confirm return"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
