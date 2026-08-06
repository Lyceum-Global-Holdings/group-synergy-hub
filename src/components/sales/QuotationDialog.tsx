import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { useCustomers } from "@/hooks/useCustomers";
import { useServices } from "@/hooks/useServices";
import { useQuotations } from "@/hooks/useQuotations";
import { SERVICE_UNITS, type Quotation, type QuotationItemInput } from "@/types/sales";

interface LineRow extends QuotationItemInput {
  _rid: string;
}
const newRid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
};

// Variance vs list price, e.g. "-10%" — the transparency behind free overrides.
const varianceOf = (unitPrice: number, listPrice: number | null | undefined): number | null => {
  if (listPrice == null || listPrice <= 0) return null;
  const v = ((unitPrice - listPrice) / listPrice) * 100;
  return Math.abs(v) < 0.005 ? 0 : v;
};

export function QuotationDialog({ open, onOpenChange, quotation, companyId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quotation: Quotation | null; // draft to edit, or null to create
  companyId?: string;
}) {
  const { formatCurrency } = useCompany();
  const { customers } = useCustomers(companyId);
  const { allActive: services } = useServices(companyId);
  const { createQuotation, updateDraftQuotation } = useQuotations(companyId);

  const [customerId, setCustomerId] = useState("");
  const [quoteDate, setQuoteDate] = useState(today());
  const [validUntil, setValidUntil] = useState(plusDays(30));
  const [discType, setDiscType] = useState<string>("none");
  const [discValue, setDiscValue] = useState("0");
  const [taxType, setTaxType] = useState<string>("none");
  const [taxValue, setTaxValue] = useState("0");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<LineRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setCustomerId(quotation?.customer_id ?? "");
    setQuoteDate(quotation?.quote_date ?? today());
    setValidUntil(quotation?.valid_until ?? plusDays(30));
    setDiscType(quotation?.discount_type ?? "none");
    setDiscValue(String(quotation?.discount_value ?? 0));
    setTaxType(quotation?.tax_type ?? "none");
    setTaxValue(String(quotation?.tax_value ?? 0));
    setNotes(quotation?.notes ?? "");
    setTerms(quotation?.terms ?? "");
    setLines(
      (quotation?.items ?? []).map((it) => ({
        _rid: newRid(),
        service_id: it.service_id,
        item_name: it.item_name,
        description: it.description,
        unit: it.unit,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        list_price: it.list_price != null ? Number(it.list_price) : null,
      })),
    );
  }, [open, quotation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addServiceLine = (serviceId: string) => {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    setLines((prev) => [...prev, {
      _rid: newRid(),
      service_id: s.id,
      item_name: s.name,
      description: s.description,
      unit: s.unit,
      quantity: 1,
      unit_price: Number(s.default_price),
      list_price: Number(s.default_price),
    }]);
  };

  const addFreeLine = () =>
    setLines((prev) => [...prev, {
      _rid: newRid(), service_id: null, item_name: "", description: null,
      unit: "job", quantity: 1, unit_price: 0, list_price: null,
    }]);

  const patchLine = (rid: string, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l) => (l._rid === rid ? { ...l, ...patch } : l)));
  const removeLine = (rid: string) =>
    setLines((prev) => prev.filter((l) => l._rid !== rid));

  // Live totals mirror of the server recompute.
  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
    const dv = Number(discValue) || 0;
    let disc = discType === "percent" ? (subtotal * dv) / 100 : discType === "fixed" ? dv : 0;
    disc = Math.min(Math.max(disc, 0), subtotal);
    const net = subtotal - disc;
    const tv = Number(taxValue) || 0;
    const tax = Math.max(taxType === "percent" ? (net * tv) / 100 : taxType === "fixed" ? tv : 0, 0);
    return { subtotal, disc, tax, total: net + tax };
  }, [lines, discType, discValue, taxType, taxValue]);

  const canSave = lines.length > 0 && lines.every((l) => l.item_name.trim() && Number(l.quantity) > 0);

  const save = async () => {
    if (!companyId || !canSave) return;
    const payload = {
      customer_id: customerId || null,
      quote_date: quoteDate,
      valid_until: validUntil || null,
      discount_type: discType === "none" ? null : (discType as 'percent' | 'fixed'),
      discount_value: Number(discValue) || 0,
      tax_type: taxType === "none" ? null : (taxType as 'percent' | 'fixed'),
      tax_value: Number(taxValue) || 0,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      company_id: companyId,
      items: lines.map(({ _rid, ...it }, i) => ({ ...it, item_name: it.item_name.trim(), sort_order: i })),
    };
    if (quotation) await updateDraftQuotation.mutateAsync({ id: quotation.id, ...payload });
    else await createQuotation.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quotation ? `Edit ${quotation.quote_number}` : "New Quotation"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Quote date</Label>
            <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Valid until</Label>
            <Input type="date" value={validUntil} min={quoteDate} onChange={(e) => setValidUntil(e.target.value)} /></div>
        </div>

        {/* Lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label>Lines</Label>
            <div className="flex gap-2">
              <Select value="" onValueChange={addServiceLine}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="＋ Add service…" />
                </SelectTrigger>
                <SelectContent>
                  {services.length === 0 && <SelectItem value="__none__" disabled>No active services — add some under Sales → Services</SelectItem>}
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {formatCurrency(Number(s.default_price))}/{s.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={addFreeLine}>
                <Plus className="h-4 w-4 mr-1" /> Free-text line
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Add services from the picker — each line's price defaults to the list price and can be changed freely.
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => {
                const variance = varianceOf(Number(l.unit_price) || 0, l.list_price);
                return (
                  <div key={l._rid} className="rounded-md border p-2.5 grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-4 space-y-1">
                      <Input
                        placeholder="Item name *"
                        value={l.item_name}
                        onChange={(e) => patchLine(l._rid, { item_name: e.target.value })}
                      />
                      <Input
                        placeholder="Description"
                        className="h-8 text-xs"
                        value={l.description ?? ""}
                        onChange={(e) => patchLine(l._rid, { description: e.target.value || null })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Select value={l.unit} onValueChange={(v) => patchLine(l._rid, { unit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SERVICE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Input
                        type="number" min={0.001} step="any" title="Quantity"
                        value={l.quantity}
                        onChange={(e) => patchLine(l._rid, { quantity: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Input
                        type="number" min={0} step="0.01" title="Unit price"
                        value={l.unit_price}
                        onChange={(e) => patchLine(l._rid, { unit_price: Number(e.target.value) || 0 })}
                      />
                      {variance != null && variance !== 0 && (
                        <Badge variant={variance < 0 ? "secondary" : "outline"} className="text-[10px]">
                          {variance > 0 ? "+" : ""}{variance.toFixed(1)}% vs list {formatCurrency(Number(l.list_price))}
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-2 pt-2 text-right text-sm font-medium">
                      {formatCurrency((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLine(l._rid)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Discount</Label>
                <Select value={discType} onValueChange={setDiscType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="percent">Percent %</SelectItem>
                    <SelectItem value="fixed">Fixed (LKR)</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>&nbsp;</Label>
                <Input type="number" min="0" step="0.01" value={discValue} disabled={discType === "none"}
                       onChange={(e) => setDiscValue(e.target.value)} /></div>
              <div className="space-y-1"><Label>Tax</Label>
                <Select value={taxType} onValueChange={setTaxType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="percent">Percent %</SelectItem>
                    <SelectItem value="fixed">Fixed (LKR)</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>&nbsp;</Label>
                <Input type="number" min="0" step="0.01" value={taxValue} disabled={taxType === "none"}
                       onChange={(e) => setTaxValue(e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="space-y-1"><Label>Terms & conditions</Label>
              <Textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
          </div>

          <div className="rounded-md border p-4 text-sm space-y-1.5 h-fit">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {formatCurrency(totals.disc)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(totals.tax)}</span></div>
            <div className="flex justify-between font-semibold text-base border-t pt-1.5">
              <span>Total</span><span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}
                  disabled={!canSave || createQuotation.isPending || updateDraftQuotation.isPending}>
            {createQuotation.isPending || updateDraftQuotation.isPending
              ? "Saving…" : quotation ? "Save changes" : "Create quotation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
