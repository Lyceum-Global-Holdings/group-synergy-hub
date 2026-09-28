import { useState } from "react";
import { format } from "date-fns";
import { PackageX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCompany } from "@/contexts/CompanyContext";
import { getCachedUserId } from "@/lib/currentUser";
import { useCanDecideHolds, useQuarantineHolds, useResolveHold, type HoldAction, type QuarantineHold } from "@/hooks/useQuarantineHolds";

const ACTIONS: { action: HoldAction; label: string; hint: string }[] = [
  { action: "release", label: "Release", hint: "The goods are usable after all (checked or repaired); they become available again." },
  { action: "scrap", label: "Scrap", hint: "Written off; the quantity leaves the bin." },
  { action: "return_to_supplier", label: "Return to supplier", hint: "Sent back to the supplier; the quantity leaves the bin." },
];

/**
 * Damaged and expired returns held in their bins. They count as on hand but
 * can't be issued or transferred until a warehouse manager decides.
 */
export function QuarantineHoldsPanel() {
  const { selectedCompany } = useCompany();
  const { data: holds = [], isLoading } = useQuarantineHolds(selectedCompany?.id);
  const { data: canDecide } = useCanDecideHolds(getCachedUserId());
  const [open, setOpen] = useState<{ hold: QuarantineHold; action: HoldAction } | null>(null);

  if (isLoading) return <p className="py-8 text-center text-muted-foreground">Loading held stock…</p>;
  if (holds.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
        <ShieldAlert className="h-10 w-10 opacity-50" />
        <p>No stock is on hold.</p>
        <p className="text-xs">Damaged and expired returns are held here when the return is approved.</p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        These goods came back damaged or expired. They are in the bin but can't be issued or transferred until
        {canDecide ? " you decide what happens to them." : " a warehouse manager decides what happens to them."}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Bin</TableHead>
            <TableHead className="text-right">Held</TableHead>
            <TableHead>Why</TableHead>
            <TableHead>Return</TableHead>
            <TableHead>Since</TableHead>
            {canDecide && <TableHead className="text-right">Decide</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {holds.map((h) => (
            <TableRow key={h.hold_id}>
              <TableCell>
                <div className="font-medium">{h.item_name}</div>
                {h.item_code && <div className="text-xs text-muted-foreground">{h.item_code}</div>}
              </TableCell>
              <TableCell>
                {h.bin_code ?? "—"}
                {h.location_name && <div className="text-xs text-muted-foreground">{h.location_name}</div>}
              </TableCell>
              <TableCell className="text-right font-medium">{h.quantity_held}</TableCell>
              <TableCell className="max-w-[16rem] whitespace-pre-line text-sm">{h.reason}</TableCell>
              <TableCell>{h.reference_number}</TableCell>
              <TableCell>{format(new Date(h.held_since), "dd MMM yyyy")}</TableCell>
              {canDecide && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {ACTIONS.map((a) => (
                      <Button key={a.action} size="sm" variant={a.action === "release" ? "outline" : "ghost"}
                        onClick={() => setOpen({ hold: h, action: a.action })}>
                        {a.label}
                      </Button>
                    ))}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {open && <DecideHoldDialog hold={open.hold} action={open.action} onClose={() => setOpen(null)} />}
    </>
  );
}

function DecideHoldDialog({ hold, action, onClose }: { hold: QuarantineHold; action: HoldAction; onClose: () => void }) {
  const resolve = useResolveHold();
  const [quantity, setQuantity] = useState(String(hold.quantity_held));
  const [note, setNote] = useState("");
  const meta = ACTIONS.find((a) => a.action === action)!;
  const qty = Number(quantity);
  const qtyValid = !Number.isNaN(qty) && qty > 0 && qty <= hold.quantity_held;
  const noteNeeded = action !== "release";

  const submit = () =>
    resolve.mutate({ holdId: hold.hold_id, action, quantity: qty, note: note.trim() }, { onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageX className="h-5 w-5" /> {meta.label}: {hold.item_name}</DialogTitle>
          <DialogDescription>{meta.hint}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="hold-qty">Quantity (up to {hold.quantity_held})</Label>
            <Input id="hold-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hold-note">{noteNeeded ? "Note (required)" : "Note"}</Label>
            <Textarea id="hold-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={action === "return_to_supplier" ? "e.g. supplier's return reference" : action === "scrap" ? "Why it can't be used" : "What was checked or repaired"} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!qtyValid || (noteNeeded && !note.trim()) || resolve.isPending}>{meta.label}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
