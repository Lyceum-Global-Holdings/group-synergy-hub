import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/components/sourcing/rfq/rfqStatus";
import { useSubmitInvoice, type PortalPo } from "@/hooks/usePortalSourcing";

interface LineDraft {
  description: string;
  quantity: string;
  unitPrice: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/** A supplier invoices one of the purchase orders sent to them. */
export function SubmitInvoiceDialog({
  open,
  onOpenChange,
  purchaseOrders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrders: PortalPo[];
}) {
  const submit = useSubmitInvoice();
  const [poId, setPoId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");

  const po = purchaseOrders.find((p) => p.id === poId);

  useEffect(() => {
    if (open) {
      setPoId(""); setInvoiceNumber(""); setInvoiceDate(today()); setDueDate("");
      setLines([]); setTax("0"); setNotes("");
    }
  }, [open]);

  // Start from the PO lines; the supplier adjusts quantities to what they deliver.
  const choosePo = (id: string) => {
    setPoId(id);
    const chosen = purchaseOrders.find((p) => p.id === id);
    setLines((chosen?.items ?? []).map((i) => ({
      description: [i.item_code, i.item_name].filter(Boolean).join(" · "),
      quantity: String(i.quantity_ordered),
      unitPrice: String(i.unit_price),
    })));
  };

  const setLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const parsed = lines.map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity), unit_price: Number(l.unitPrice) }));
  const linesValid = parsed.length > 0 && parsed.every((l) => l.quantity > 0 && l.unit_price >= 0 && !Number.isNaN(l.quantity) && !Number.isNaN(l.unit_price));
  const subtotal = linesValid ? parsed.reduce((s, l) => s + l.quantity * l.unit_price, 0) : 0;
  const taxAmount = Number(tax) || 0;
  const canSubmit = !!po && invoiceNumber.trim() && invoiceDate && linesValid && taxAmount >= 0 && (!dueDate || dueDate >= invoiceDate);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;
    await submit.mutateAsync({
      poId: po.id,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      dueDate: dueDate || undefined,
      lines: parsed,
      taxAmount,
      notes,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit an invoice</DialogTitle>
          <DialogDescription>Invoice a purchase order you've received. The buyer's finance team checks it against the order and the goods received.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Purchase order</Label>
              <Select value={poId} onValueChange={choosePo}>
                <SelectTrigger aria-label="Purchase order">
                  <SelectValue placeholder={purchaseOrders.length ? "Choose a purchase order" : "No purchase orders to invoice yet"} />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.po_number} · {new Date(p.po_date).toLocaleDateString()} · {formatMoney(p.final_amount ?? p.total_amount, p.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-number">Your invoice number</Label>
              <Input id="inv-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-date">Invoice date</Label>
                <Input id="inv-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-due">Due date</Label>
                <Input id="inv-due" type="date" value={dueDate} min={invoiceDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>

          {po && (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-28">Quantity</TableHead>
                      <TableHead className="w-32">Unit price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell><Input aria-label={`Line ${i + 1} description`} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></TableCell>
                        <TableCell><Input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></TableCell>
                        <TableCell><Input aria-label={`Line ${i + 1} unit price`} inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} /></TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {Number(l.quantity) > 0 && Number(l.unitPrice) >= 0 ? formatMoney(Number(l.quantity) * Number(l.unitPrice), po.currency) : "—"}
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, { description: "", quantity: "1", unitPrice: "0" }])}>
                <Plus className="mr-1.5 h-4 w-4" /> Add line
              </Button>

              <div className="ml-auto grid max-w-xs grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-right tabular-nums">{formatMoney(subtotal, po.currency)}</span>
                <Label htmlFor="inv-tax" className="font-normal text-muted-foreground">Tax (VAT etc.)</Label>
                <Input id="inv-tax" inputMode="decimal" className="h-8 w-32 text-right" value={tax} onChange={(e) => setTax(e.target.value)} />
                <span className="font-semibold">Invoice total</span>
                <span className="text-right font-semibold tabular-nums">{formatMoney(subtotal + taxAmount, po.currency)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea id="inv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || submit.isPending}>
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
