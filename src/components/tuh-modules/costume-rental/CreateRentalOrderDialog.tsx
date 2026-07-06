import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCustomers } from "@/hooks/useCustomers";
import { useCostumes } from "@/hooks/useCostumes";
import { useRentalOrders } from "@/hooks/useRentalOrders";
import { fetchRentalAvailability } from "@/hooks/useRentalAvailability";
import { formatCurrency } from "@/lib/utils";
import type { Costume } from "@/types/costumeRental";
import { costumeSizeOptions, sizeLabel } from "./sizeUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  initialItems?: { costume_id: string; size: string; quantity: number; unit_id?: string | null; unit_code?: string | null }[];
  onCreated?: () => void;
}

interface LineRow {
  costume_id: string;
  size: string;
  quantity: number;
  available?: number | null;
  preferred_unit_id?: string | null;
  unit_code?: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
};
const rentalDays = (from: string, to: string) =>
  Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));

export function CreateRentalOrderDialog({ open, onOpenChange, companyId, initialItems, onCreated }: Props) {
  const { customers } = useCustomers(companyId);
  const { costumes } = useCostumes(companyId);
  const { createOrder, isCreating } = useRentalOrders(companyId);

  const [customerId, setCustomerId] = useState<string>("");
  const [pickup, setPickup] = useState(today());
  const [due, setDue] = useState(addDays(today(), 1));
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineRow[]>([]);

  useEffect(() => {
    if (open) {
      setCustomerId(""); setPickup(today()); setDue(addDays(today(), 1));
      setDiscount("0"); setTax("0"); setNotes("");
      const seeded = (initialItems ?? []).map((i) => ({
        costume_id: i.costume_id, size: i.size, quantity: i.quantity, available: null,
        preferred_unit_id: i.unit_id ?? null, unit_code: i.unit_code ?? null,
      }));
      setLines(seeded);
      if (seeded.length > 0) refreshAvailability(seeded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const costumeById = useMemo(
    () => new Map(costumes.map((c: Costume) => [c.id, c])), [costumes]);
  const days = rentalDays(pickup, due);

  const lineTotal = (l: LineRow) => {
    const c = costumeById.get(l.costume_id);
    if (!c) return 0;
    return c.flat_rate != null ? c.flat_rate * l.quantity : c.daily_rate * days * l.quantity;
  };
  const lineDeposit = (l: LineRow) => {
    const c = costumeById.get(l.costume_id);
    return c ? c.security_deposit * l.quantity : 0;
  };

  const rentalTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const depositTotal = lines.reduce((s, l) => s + lineDeposit(l), 0);
  const grandTotal = rentalTotal + (Number(tax) || 0) - (Number(discount) || 0);

  const refreshAvailability = async (rows: LineRow[]) => {
    const updated = await Promise.all(rows.map(async (l) => {
      if (!l.costume_id) return { ...l, available: null };
      try { return { ...l, available: await fetchRentalAvailability(l.costume_id, pickup, due, undefined, l.size) }; }
      catch { return { ...l, available: null }; }
    }));
    setLines(updated);
  };

  // Recompute availability when dates change.
  useEffect(() => {
    if (open && lines.some((l) => l.costume_id)) refreshAvailability(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, due]);

  const addLine = () => setLines((p) => [...p, { costume_id: "", size: "", quantity: 1, available: null }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const setLine = async (i: number, patch: Partial<LineRow>) => {
    // When the costume changes, default the size to its first available variant.
    if (patch.costume_id) {
      const opts = costumeSizeOptions(costumeById.get(patch.costume_id));
      patch.size = opts[0]?.size ?? "";
    }
    const next = lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    setLines(next);
    const row = next[i];
    if (row.costume_id) {
      try {
        const avail = await fetchRentalAvailability(row.costume_id, pickup, due, undefined, row.size);
        setLines((p) => p.map((l, idx) => (idx === i ? { ...l, available: avail } : l)));
      } catch { /* ignore */ }
    }
  };

  const handleSubmit = async () => {
    if (!companyId) { toast.error("Select a company first"); return; }
    const valid = lines.filter((l) => l.costume_id && l.quantity > 0);
    if (valid.length === 0) { toast.error("Add at least one costume"); return; }
    if (new Date(due) < new Date(pickup)) { toast.error("Return date must be on/after pickup"); return; }
    try {
      await createOrder.mutateAsync({
        customer_id: customerId || null,
        pickup_date: pickup,
        due_date: due,
        discount_amount: Number(discount) || 0,
        tax_amount: Number(tax) || 0,
        notes: notes.trim() || null,
        company_id: companyId,
        items: valid.map((l) => {
          const c = costumeById.get(l.costume_id)!;
          return {
            costume_id: l.costume_id,
            size: l.size,
            quantity: l.quantity,
            daily_rate: c.daily_rate,
            rental_days: days,
            line_total: lineTotal(l),
            security_deposit: lineDeposit(l),
            preferred_unit_id: l.preferred_unit_id ?? null,
          };
        }),
      });
      onCreated?.();
      onOpenChange(false);
    } catch { /* toast in hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Rental Order</DialogTitle></DialogHeader>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Pickup date</Label>
            <Input type="date" value={pickup} onChange={(e) => setPickup(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Return (due) date</Label>
            <Input type="date" value={due} min={pickup} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Rental period: {days} day(s)</p>

        {/* Lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Costumes</Label>
            <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add costume</Button>
          </div>
          {lines.length === 0 && <p className="text-sm text-muted-foreground">No costumes added yet.</p>}
          {lines.map((l, i) => {
            const c = costumeById.get(l.costume_id);
            const over = l.available != null && l.quantity > l.available;
            const sizeOpts = costumeSizeOptions(c);
            const hasSizes = sizeOpts.length > 1 || (sizeOpts.length === 1 && sizeOpts[0].size !== "");
            return (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                <Select value={l.costume_id} onValueChange={(v) => setLine(i, { costume_id: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select costume" /></SelectTrigger>
                  <SelectContent>
                    {costumes.filter((x: Costume) => x.status === "active").map((x: Costume) => (
                      <SelectItem key={x.id} value={x.id}>{x.name} ({x.costume_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {l.preferred_unit_id ? (
                  <Badge variant="outline" className="whitespace-nowrap font-mono text-[11px]">{l.unit_code}</Badge>
                ) : l.costume_id && hasSizes && (
                  <Select value={l.size} onValueChange={(v) => setLine(i, { size: v })}>
                    <SelectTrigger className="w-24"><SelectValue placeholder="Size" /></SelectTrigger>
                    <SelectContent>
                      {sizeOpts.map((s) => (
                        <SelectItem key={s.size || "_one"} value={s.size}>{sizeLabel(s.size)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  type="number" min={1} className="w-20" value={l.quantity}
                  disabled={!!l.preferred_unit_id}
                  onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                />
                {l.costume_id && (
                  <Badge variant={over ? "destructive" : "secondary"} className="whitespace-nowrap">
                    {over && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {l.available ?? "…"} avail
                  </Badge>
                )}
                <span className="w-28 text-right text-sm">{c ? formatCurrency(lineTotal(l)) : "—"}</span>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeLine(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Discount (LKR)</Label>
            <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div className="space-y-1"><Label>Tax (LKR)</Label>
            <Input type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>

        <div className="rounded-md border p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Rental total</span><span>{formatCurrency(rentalTotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Security deposit</span><span>{formatCurrency(depositTotal)}</span></div>
          <div className="flex justify-between font-medium"><span>Payable (rental + tax − discount)</span><span>{formatCurrency(grandTotal)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isCreating}>{isCreating ? "Creating…" : "Create draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
