import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useCustomers } from "@/hooks/useCustomers";
import { useBankAccounts } from "@/hooks/finance/useBankAccounts";
import { useRecordMoney } from "@/hooks/finance/useFinancePosting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const METHODS = {
  payment: [["wire", "Bank transfer"], ["check", "Cheque"], ["online", "Online"], ["cash", "Cash"], ["ach", "Direct debit"]],
  receipt: [["wire", "Bank transfer"], ["check", "Cheque"], ["online", "Online"], ["card", "Card"], ["cash", "Cash"], ["ach", "Direct debit"]],
} as const;

interface OpenInvoice { id: string; invoice_number: string; invoice_date: string; gross_amount: number; paid: number }

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Records a supplier payment or customer receipt in one step: allocated to
 * posted invoices, the bank transaction and balance, and the journal.
 */
export function RecordMoneyDialog({ kind, open, onOpenChange }: { kind: "payment" | "receipt"; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { data: suppliers = [] } = useSuppliers();
  const { customers = [] } = useCustomers(companyId);
  const { bankAccounts = [] } = useBankAccounts();
  const record = useRecordMoney(kind);

  const [partyId, setPartyId] = useState<string>();
  const [bankId, setBankId] = useState<string>();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("wire");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [alloc, setAlloc] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setPartyId(undefined); setDate(today()); setAmount(""); setReference(""); setNotes(""); setAlloc({});
    setBankId((bankAccounts as { id: string; is_default?: boolean }[]).find((b) => b.is_default)?.id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Posted invoices of this supplier / customer with something still to pay.
  const { data: invoices = [] } = useQuery({
    queryKey: [kind === "payment" ? "outstanding-supplier-invoices" : "outstanding-customer-invoices", companyId, partyId],
    queryFn: async (): Promise<OpenInvoice[]> => {
      if (kind === "payment") {
        const { data, error } = await supabase.from("supplier_invoices")
          .select("id, invoice_number, invoice_date, gross_amount, amount_paid")
          .eq("company_id", companyId!).eq("supplier_id", partyId!).in("status", ["posted", "partially_paid"]).order("invoice_date");
        if (error) throw error;
        return (data ?? []).map((i) => ({ id: i.id, invoice_number: i.invoice_number, invoice_date: i.invoice_date, gross_amount: Number(i.gross_amount), paid: Number(i.amount_paid ?? 0) }));
      }
      const { data, error } = await supabase.from("customer_invoices")
        .select("id, invoice_number, invoice_date, gross_amount, amount_received")
        .eq("company_id", companyId!).eq("customer_id", partyId!).in("status", ["posted", "partially_paid"]).order("invoice_date");
      if (error) throw error;
      return (data ?? []).map((i) => ({ id: i.id, invoice_number: i.invoice_number, invoice_date: i.invoice_date, gross_amount: Number(i.gross_amount), paid: Number(i.amount_received ?? 0) }));
    },
    enabled: open && !!companyId && !!partyId,
  });

  const amountNum = Number(amount) || 0;
  const allocations = invoices.map((i) => ({ invoice_id: i.id, amount: Number(alloc[i.id]) || 0, outstanding: round2(i.gross_amount - i.paid) }));
  const allocated = round2(allocations.reduce((s, a) => s + a.amount, 0));
  const overLine = allocations.some((a) => a.amount < 0 || a.amount > a.outstanding + 0.005);
  const overTotal = allocated > amountNum + 0.005;

  // Fill the oldest invoices first.
  const autoAllocate = () => {
    let left = amountNum;
    const next: Record<string, string> = {};
    for (const a of allocations) {
      const take = round2(Math.min(left, a.outstanding));
      if (take > 0) next[a.invoice_id] = String(take);
      left = round2(left - take);
    }
    setAlloc(next);
  };

  const parties = useMemo(
    () => (kind === "payment"
      ? (suppliers as { id: string; name: string; supplier_code?: string }[]).map((s) => ({ id: s.id, label: `${s.supplier_code ? s.supplier_code + " · " : ""}${s.name}` }))
      : (customers as { id: string; customer_name: string; customer_code?: string }[]).map((c) => ({ id: c.id, label: `${c.customer_code ? c.customer_code + " · " : ""}${c.customer_name}` }))),
    [kind, suppliers, customers],
  );

  const canSave = !!companyId && !!partyId && !!bankId && amountNum > 0 && !!date && date <= today() && !overLine && !overTotal && !record.isPending;
  const submit = () => {
    if (!canSave) return;
    record.mutate(
      { companyId: companyId!, partyId: partyId!, bankAccountId: bankId!, date, amount: amountNum, method, reference, notes,
        allocations: allocations.map(({ invoice_id, amount }) => ({ invoice_id, amount })) },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const party = kind === "payment" ? "Supplier" : "Customer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind === "payment" ? "Record supplier payment" : "Record customer receipt"}</DialogTitle>
          <DialogDescription>
            Allocates it to posted invoices, records the bank transaction and writes the journal. A supplier invoice from a PO can
            only be paid once its three-way match is accepted.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{party} *</Label>
            <Select value={partyId} onValueChange={(v) => { setPartyId(v); setAlloc({}); }}>
              <SelectTrigger aria-label={party}><SelectValue placeholder={`Choose the ${party.toLowerCase()}`} /></SelectTrigger>
              <SelectContent>{parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Bank account *</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger aria-label="Bank account"><SelectValue placeholder="Choose the bank account" /></SelectTrigger>
              <SelectContent>
                {(bankAccounts as { id: string; account_name: string; bank_name?: string }[]).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.account_name}{b.bank_name ? ` · ${b.bank_name}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="money-date">Date *</Label>
            <Input id="money-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="money-amount">Amount *</Label>
            <Input id="money-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger aria-label="Method"><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS[kind].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="money-reference">Reference</Label>
            <Input id="money-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque or transfer number" />
          </div>
        </div>

        {partyId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Allocate to invoices</Label>
              <Button type="button" size="sm" variant="outline" onClick={autoAllocate} disabled={amountNum <= 0 || invoices.length === 0}>
                Fill oldest first
              </Button>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posted invoices outstanding. The whole amount is recorded as an advance.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Allocate</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.invoice_number}</TableCell>
                      <TableCell>{i.invoice_date}</TableCell>
                      <TableCell className="text-right">{round2(i.gross_amount - i.paid).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Input aria-label={`Allocate to ${i.invoice_number}`} className="ml-auto h-8 w-32 text-right" inputMode="decimal"
                          value={alloc[i.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [i.id]: e.target.value })} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className={`text-sm ${overTotal || overLine ? "text-destructive" : "text-muted-foreground"}`}>
              {overLine ? "An allocation is more than that invoice's outstanding amount."
                : overTotal ? `Allocations (${allocated.toLocaleString()}) are more than the amount.`
                : `Allocated ${allocated.toLocaleString()} of ${amountNum.toLocaleString()}${amountNum - allocated > 0.005 ? `; ${round2(amountNum - allocated).toLocaleString()} as an advance` : ""}.`}
            </p>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="money-notes">Notes</Label>
          <Textarea id="money-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSave}>
            {record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {kind === "payment" ? "Record payment" : "Record receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
