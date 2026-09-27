import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubmitQuote } from "@/hooks/useRfqWorkflow";
import type { RfqRfpItem, SupplierQuote } from "@/types/rfqRfp";
import { formatDeadline, formatMoney } from "./rfqStatus";

export interface QuoteEntryRfq {
  id: string;
  request_number: string;
  title: string;
  currency?: string | null;
  submission_deadline?: string | null;
  items: RfqRfpItem[];
}

interface LineDraft {
  unitPrice: string;
  deliveryDays: string;
  notes: string;
}

/**
 * Enter or update a supplier's quote for an RFQ. Used by suppliers in the
 * portal and by buyers recording a quote on a supplier's behalf.
 */
export function QuoteEntryDialog({
  open,
  onOpenChange,
  rfq,
  supplierId,
  supplierName,
  existing,
  onBehalf = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfq: QuoteEntryRfq;
  supplierId: string;
  supplierName?: string;
  existing?: SupplierQuote | null;
  /** A buyer entering a quote received by email or on paper. */
  onBehalf?: boolean;
}) {
  const submit = useSubmitQuote();
  const items = useMemo(() => [...rfq.items].sort((a, b) => a.line_number - b.line_number), [rfq.items]);
  const [lines, setLines] = useState<Record<string, LineDraft>>({});
  const [paymentTerms, setPaymentTerms] = useState("");
  const [delivery, setDelivery] = useState("");
  const [validity, setValidity] = useState("30");
  const [warranty, setWarranty] = useState("");
  const [notes, setNotes] = useState("");

  // Prefill from an existing quote each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const byItem = new Map((existing?.items ?? []).map((i) => [i.rfq_item_id, i]));
    setLines(
      Object.fromEntries(
        items.map((it) => {
          const q = byItem.get(it.id!);
          return [it.id!, {
            unitPrice: q ? String(q.unit_price) : "",
            deliveryDays: q?.delivery_days != null ? String(q.delivery_days) : "",
            notes: q?.notes ?? "",
          }];
        }),
      ),
    );
    setPaymentTerms(existing?.payment_terms ?? "");
    setDelivery(existing?.delivery_commitment ?? "");
    setValidity(existing?.validity_period != null ? String(existing.validity_period) : "30");
    setWarranty(existing?.warranty_offered ?? "");
    setNotes(existing?.notes ?? "");
  }, [open, existing, items]);

  const setLine = (id: string, patch: Partial<LineDraft>) =>
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const priceOf = (id: string) => {
    const v = lines[id]?.unitPrice?.trim();
    return v ? Number(v) : null;
  };
  const invalidPrice = items.some((it) => {
    const p = priceOf(it.id!);
    return p != null && (Number.isNaN(p) || p < 0);
  });
  const pricedCount = items.filter((it) => priceOf(it.id!) != null).length;
  const total = items.reduce((sum, it) => sum + (priceOf(it.id!) ?? 0) * Number(it.quantity), 0);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit.mutateAsync({
      requestId: rfq.id,
      supplierId,
      lines: items.map((it) => ({
        rfq_item_id: it.id!,
        unit_price: priceOf(it.id!),
        delivery_days: lines[it.id!]?.deliveryDays ? Number(lines[it.id!].deliveryDays) : null,
        notes: lines[it.id!]?.notes,
      })),
      paymentTerms,
      deliveryCommitment: delivery,
      validityDays: validity ? Number(validity) : 30,
      warranty,
      notes,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Update quote" : "Submit quote"} · {rfq.request_number}</DialogTitle>
          <DialogDescription>
            {rfq.title}
            {supplierName ? ` · ${onBehalf ? "on behalf of " : ""}${supplierName}` : ""}
            {rfq.submission_deadline ? ` · due ${formatDeadline(rfq.submission_deadline)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="w-36">Unit price ({rfq.currency ?? "LKR"})</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                  <TableHead className="w-28">Delivery (days)</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const price = priceOf(it.id!);
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <div className="font-medium">{it.item_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[it.item_code, it.specifications || it.description].filter(Boolean).join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {Number(it.quantity).toLocaleString()} {it.unit_of_measure}
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Unit price for ${it.item_name}`}
                          inputMode="decimal"
                          placeholder="Not quoted"
                          value={lines[it.id!]?.unitPrice ?? ""}
                          onChange={(e) => setLine(it.id!, { unitPrice: e.target.value })}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {price != null && !Number.isNaN(price) ? formatMoney(price * Number(it.quantity), rfq.currency) : "—"}
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Delivery days for ${it.item_name}`}
                          inputMode="numeric"
                          value={lines[it.id!]?.deliveryDays ?? ""}
                          onChange={(e) => setLine(it.id!, { deliveryDays: e.target.value.replace(/\D/g, "") })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Note for ${it.item_name}`}
                          value={lines[it.id!]?.notes ?? ""}
                          onChange={(e) => setLine(it.id!, { notes: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    Total · {pricedCount} of {items.length} item{items.length === 1 ? "" : "s"} priced
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{formatMoney(total, rfq.currency)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Leave the price empty for items you don't supply.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quote-payment">Payment terms</Label>
              <Input id="quote-payment" placeholder="e.g. 30 days after invoice" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-delivery">Delivery commitment</Label>
              <Input id="quote-delivery" placeholder="e.g. Within 7 days of order" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-validity">Quote valid for (days)</Label>
              <Input id="quote-validity" inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-warranty">Warranty</Label>
              <Input id="quote-warranty" value={warranty} onChange={(e) => setWarranty(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote-notes">Notes</Label>
            <Textarea id="quote-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submit.isPending || pricedCount === 0 || invalidPrice}>
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existing ? "Update quote" : "Submit quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
