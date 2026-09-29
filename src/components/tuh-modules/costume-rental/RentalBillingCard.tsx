import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { untypedRpc } from "@/lib/untypedRpc";
import { formatCurrency } from "@/lib/utils";
import { useBankAccounts } from "@/hooks/finance/useBankAccounts";
import type { RentalOrder } from "@/types/costumeRental";

const METHODS = [["cash", "Cash"], ["card", "Card"], ["wire", "Bank transfer"], ["check", "Cheque"], ["online", "Online"]] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

interface RentalInvoice { id: string; invoice_number: string; status: string; gross_amount: number; tax_amount: number | null; amount_received: number | null }

type Mode = "record" | "settle" | "refund";

/**
 * What the rental has been invoiced and what happened to its deposit.
 * Checking out invoices the rental; a return with fees invoices those. The
 * deposit is recorded when taken and, after the return, pays the rental's
 * invoices (fees first) with the rest refunded.
 */
export function RentalBillingCard({ order }: { order: RentalOrder }) {
  const qc = useQueryClient();
  const { bankAccounts = [] } = useBankAccounts();
  const [mode, setMode] = useState<Mode | null>(null);
  const [amount, setAmount] = useState("");
  const [bankId, setBankId] = useState<string>();
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

  const { data: invoices = [] } = useQuery({
    queryKey: ["rental-billing", order.id],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("customer_invoices")
        .select("id, invoice_number, status, gross_amount, tax_amount, amount_received")
        .eq("rental_order_id", order.id)
        .order("invoice_date");
      if (error) throw error;
      return (data ?? []) as RentalInvoice[];
    },
  });

  const received = Number(order.deposit_received ?? 0);
  const applied = Number(order.deposit_applied ?? 0);
  const refunded = Number(order.deposit_refunded ?? 0);
  const held = round2(received - applied - refunded);
  const stillDue = round2(Number(order.deposit_total) - received);
  // Invoice total: drafts store the amount before tax, posted ones the total.
  const total = (i: RentalInvoice) => (["draft", "pending"].includes(i.status) ? Number(i.gross_amount) + Number(i.tax_amount ?? 0) : Number(i.gross_amount));
  const owing = round2(invoices.filter((i) => !["cancelled", "written_off"].includes(i.status))
    .reduce((s, i) => s + Math.max(0, total(i) - Number(i.amount_received ?? 0)), 0));
  const refundOnSettle = round2(Math.max(0, held - owing));

  useEffect(() => {
    if (!mode) return;
    setAmount(mode === "record" ? String(Math.max(0, stillDue)) : "");
    setReference("");
    setMethod("cash");
    setBankId((bankAccounts as { id: string; is_default?: boolean }[]).find((b) => b.is_default)?.id);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useMutation({
    mutationFn: async () => {
      if (mode === "record") {
        return untypedRpc("record_rental_deposit", { p_order_id: order.id, p_amount: Number(amount), p_bank_account_id: bankId,
          p_method: method, p_reference: reference, p_date: today() });
      }
      if (mode === "refund") {
        return untypedRpc("refund_rental_deposit", { p_order_id: order.id, p_bank_account_id: bankId, p_method: method, p_reference: reference, p_date: today() });
      }
      return untypedRpc("settle_rental_deposit", { p_order_id: order.id, p_bank_account_id: refundOnSettle > 0 ? bankId : null,
        p_method: method, p_reference: reference, p_date: today() });
    },
    onSuccess: () => {
      for (const k of ["rental-order", "rental-orders", "rental-billing", "customer-invoices"]) qc.invalidateQueries({ queryKey: [k] });
      toast.success(mode === "record" ? "Deposit recorded" : mode === "refund" ? "Deposit refunded" : "Deposit settled");
      setMode(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needsBank = mode === "record" || mode === "refund" || (mode === "settle" && refundOnSettle > 0);
  const canRun = !run.isPending && (!needsBank || !!bankId) && (mode !== "record" || (Number(amount) > 0 && Number(amount) <= stillDue + 0.005));

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Billing</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {invoices.length === 0 ? (
          <p className="text-muted-foreground">
            {["draft", "pending_approval", "approved"].includes(order.status) ? "The rental is invoiced when it is checked out." : "No invoice for this rental."}
          </p>
        ) : (
          <div className="space-y-1">
            {invoices.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Link to="/finance?tab=ar" className="font-mono underline-offset-2 hover:underline">{i.invoice_number}</Link>{" "}
                  <span className="text-muted-foreground">{i.id === order.charges_invoice_id ? "Late / damage fees" : "Rental"}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{i.status.replace("_", " ")}</Badge>
                  {formatCurrency(total(i))}
                  {Number(i.amount_received ?? 0) > 0 && <span className="text-muted-foreground">({formatCurrency(Number(i.amount_received))} paid)</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t pt-2 md:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Deposit due</p><p>{formatCurrency(Number(order.deposit_total))}</p></div>
          <div><p className="text-xs text-muted-foreground">Taken</p><p>{formatCurrency(received)}</p></div>
          <div><p className="text-xs text-muted-foreground">Paid to invoices</p><p>{formatCurrency(applied)}</p></div>
          <div><p className="text-xs text-muted-foreground">Refunded</p><p>{formatCurrency(refunded)}</p></div>
        </div>
        {held > 0 && <p className="font-medium">Deposit held: {formatCurrency(held)}</p>}

        <div className="flex flex-wrap gap-2">
          {["approved", "checked_out"].includes(order.status) && stillDue > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMode("record")}>Record deposit</Button>
          )}
          {order.status === "returned" && held > 0 && <Button size="sm" onClick={() => setMode("settle")}>Settle deposit</Button>}
          {order.status === "approved" && held > 0 && <Button size="sm" variant="outline" onClick={() => setMode("refund")}>Refund deposit</Button>}
        </div>
      </CardContent>

      <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "record" ? "Record deposit" : mode === "refund" ? "Refund deposit" : "Settle deposit"} · {order.rental_number}</DialogTitle>
            <DialogDescription>
              {mode === "record" && "Posted to customer deposits until the rental is settled."}
              {mode === "refund" && `The rental won't go ahead: ${formatCurrency(held)} is paid back.`}
              {mode === "settle" &&
                `${formatCurrency(Math.min(held, owing))} pays the rental's open invoices (fees first; draft invoices are posted)` +
                (refundOnSettle > 0 ? ` and ${formatCurrency(refundOnSettle)} is refunded.` : ".")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {mode === "record" && (
              <div className="space-y-1">
                <Label htmlFor="deposit-amount">Amount *</Label>
                <Input id="deposit-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            )}
            {needsBank && (
              <>
                <div className="space-y-1">
                  <Label>{mode === "record" ? "Received into *" : "Paid from *"}</Label>
                  <Select value={bankId} onValueChange={setBankId}>
                    <SelectTrigger aria-label="Bank account"><SelectValue placeholder="Choose the account" /></SelectTrigger>
                    <SelectContent>
                      {(bankAccounts as { id: string; account_name: string; bank_name?: string }[]).map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.account_name}{b.bank_name ? ` · ${b.bank_name}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger aria-label="Method"><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="deposit-ref">Reference</Label>
                  <Input id="deposit-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt or transfer number" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={() => run.mutate()} disabled={!canRun}>
              {mode === "record" ? "Record deposit" : mode === "refund" ? "Refund" : "Settle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
