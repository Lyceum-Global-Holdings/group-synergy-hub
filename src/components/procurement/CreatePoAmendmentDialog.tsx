import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreatePoAmendment } from "@/hooks/usePoAmendments";
import { amendmentTypes, emptyAmendmentDraft, planAmendment, type AmendmentDraft, type NewLineDraft } from "@/components/procurement/amendmentChanges";
import type { PoAmendmentType, PurchaseOrder } from "@/types/purchaseOrder";

interface CreatePoAmendmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
}

const blankLine = (): NewLineDraft => ({ item_name: "", item_code: "", quantity: "", unit_price: "", unit_of_measure: "pcs" });

export function CreatePoAmendmentDialog({ open, onOpenChange, purchaseOrder: po }: CreatePoAmendmentDialogProps) {
  const [amendmentType, setAmendmentType] = useState<PoAmendmentType>('price_change');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState<AmendmentDraft>(() => emptyAmendmentDraft(po));
  const createAmendment = useCreatePoAmendment();

  const items = useMemo(() => (po.items ?? []).filter((i) => i.id), [po.items]);
  const currency = po.currency || 'LKR';
  const money = (n: number) => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const currentTotal = items.reduce((s, i) => s + Number(i.total_price || 0), 0);

  // Start fresh each time the dialog opens (not when the PO refetches while open).
  useEffect(() => {
    if (!open) return;
    setAmendmentType('price_change');
    setReason('');
    setNotes('');
    setDraft(emptyAmendmentDraft(po));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, po.id]);

  const plan = planAmendment(amendmentType, draft, items, po);
  const canSubmit = !!reason.trim() && !plan.problem && !createAmendment.isPending;

  const setLineValue = (id: string, value: string) =>
    setDraft((d) => ({ ...d, lineValues: { ...d.lineValues, [id]: value } }));
  const setNewLine = (index: number, patch: Partial<NewLineDraft>) =>
    setDraft((d) => ({ ...d, newLines: d.newLines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await createAmendment.mutateAsync({
      po_id: po.id,
      amendment_type: amendmentType,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      changes: plan.changes,
    });
    onOpenChange(false);
  };

  const hint = amendmentTypes.find((t) => t.value === amendmentType)?.hint;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Amend {po.po_number}</DialogTitle>
          <DialogDescription>
            The change is applied to the purchase order when someone with department head approval rights approves it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="amendment-type">What changes? *</Label>
            <Select
              value={amendmentType}
              onValueChange={(value) => {
                setAmendmentType(value as PoAmendmentType);
                setDraft(emptyAmendmentDraft(po));
              }}
            >
              <SelectTrigger id="amendment-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {amendmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>

          {(amendmentType === 'price_change' || amendmentType === 'quantity_change') && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">{amendmentType === 'price_change' ? 'Current price' : 'Ordered'}</TableHead>
                  {amendmentType === 'quantity_change' && <TableHead className="text-right">Received</TableHead>}
                  <TableHead className="w-40">{amendmentType === 'price_change' ? 'New price' : 'New quantity'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.item_name}</div>
                      {item.item_code && <div className="text-xs text-muted-foreground">{item.item_code}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      {amendmentType === 'price_change' ? money(Number(item.unit_price)) : `${item.quantity_ordered} ${item.unit_of_measure}`}
                    </TableCell>
                    {amendmentType === 'quantity_change' && (
                      <TableCell className="text-right">{Number(item.quantity_received || 0)}</TableCell>
                    )}
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        aria-label={`New ${amendmentType === 'price_change' ? 'price' : 'quantity'} for ${item.item_name}`}
                        placeholder="unchanged"
                        value={draft.lineValues[item.id!] ?? ''}
                        onChange={(e) => setLineValue(item.id!, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {amendmentType === 'item_removal' && (
            <div className="space-y-2">
              {items.map((item) => {
                const received = Number(item.quantity_received || 0) > 0;
                return (
                  <label key={item.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                    <Checkbox
                      aria-label={`Remove ${item.item_name}`}
                      disabled={received}
                      checked={draft.removeIds.includes(item.id!)}
                      onCheckedChange={(checked) =>
                        setDraft((d) => ({
                          ...d,
                          removeIds: checked ? [...d.removeIds, item.id!] : d.removeIds.filter((x) => x !== item.id),
                        }))
                      }
                    />
                    <span className="flex-1">{item.item_name} · {item.quantity_ordered} {item.unit_of_measure} × {money(Number(item.unit_price))}</span>
                    {received && <span className="text-xs text-muted-foreground">Already received</span>}
                  </label>
                );
              })}
            </div>
          )}

          {amendmentType === 'item_addition' && (
            <div className="space-y-2">
              {draft.newLines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-4" aria-label={`New item ${index + 1} name`} placeholder="Item name" value={line.item_name} onChange={(e) => setNewLine(index, { item_name: e.target.value })} />
                  <Input className="col-span-2" aria-label={`New item ${index + 1} code`} placeholder="Code" value={line.item_code} onChange={(e) => setNewLine(index, { item_code: e.target.value })} />
                  <Input className="col-span-2" inputMode="decimal" aria-label={`New item ${index + 1} quantity`} placeholder="Qty" value={line.quantity} onChange={(e) => setNewLine(index, { quantity: e.target.value })} />
                  <Input className="col-span-1" aria-label={`New item ${index + 1} unit`} placeholder="UoM" value={line.unit_of_measure} onChange={(e) => setNewLine(index, { unit_of_measure: e.target.value })} />
                  <Input className="col-span-2" inputMode="decimal" aria-label={`New item ${index + 1} unit price`} placeholder="Unit price" value={line.unit_price} onChange={(e) => setNewLine(index, { unit_price: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-1" aria-label={`Remove new item ${index + 1}`}
                    onClick={() => setDraft((d) => ({ ...d, newLines: d.newLines.filter((_, i) => i !== index) }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, newLines: [...d.newLines, blankLine()] }))}>
                <Plus className="mr-2 h-4 w-4" /> Add line
              </Button>
            </div>
          )}

          {amendmentType === 'delivery_date_change' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Current delivery date</Label>
                <p className="text-sm">{po.expected_delivery_date ? po.expected_delivery_date.slice(0, 10) : 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-delivery-date">New delivery date *</Label>
                <Input id="new-delivery-date" type="date" value={draft.deliveryDate} onChange={(e) => setDraft((d) => ({ ...d, deliveryDate: e.target.value }))} />
              </div>
            </div>
          )}

          {amendmentType === 'terms_change' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="new-payment-terms">Payment terms</Label>
                <Input id="new-payment-terms" value={draft.paymentTerms} onChange={(e) => setDraft((d) => ({ ...d, paymentTerms: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-delivery-terms">Delivery terms</Label>
                <Input id="new-delivery-terms" value={draft.deliveryTerms} onChange={(e) => setDraft((d) => ({ ...d, deliveryTerms: e.target.value }))} />
              </div>
            </div>
          )}

          {plan.newTotal !== null && (
            <p className="text-sm">
              Line total {money(currentTotal)} → <span className="font-semibold">{money(plan.newTotal)}</span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the order changing?" rows={2} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {plan.problem && amendmentType !== 'other' && (
            <p className="text-sm text-muted-foreground" role="status">{plan.problem}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createAmendment.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createAmendment.isPending ? "Requesting..." : "Request Amendment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
