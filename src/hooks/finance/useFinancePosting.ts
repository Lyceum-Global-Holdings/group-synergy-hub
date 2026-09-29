import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { untypedRpc } from "@/lib/untypedRpc";

/** Invoice statuses that can still be posted. */
export const POSTABLE_SUPPLIER = ["draft", "pending_approval", "approved"];
export const POSTABLE_CUSTOMER = ["draft", "pending"];

const FINANCE_KEYS = ["supplier-invoices", "customer-invoices", "supplier-payments", "customer-receipts", "journal-entries",
  "chart-of-accounts", "bank-accounts", "bank-transactions", "outstanding-supplier-invoices", "outstanding-customer-invoices"];

function useRefresh() {
  const qc = useQueryClient();
  return () => FINANCE_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

/** Posts the invoice and writes its journal (post_supplier_invoice / post_customer_invoice). */
export function usePostInvoice(kind: "supplier" | "customer") {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      untypedRpc<string>(kind === "supplier" ? "post_supplier_invoice" : "post_customer_invoice", { p_invoice_id: invoiceId }),
    onSuccess: () => { refresh(); toast.success("Invoice posted and its journal written"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface RecordMoneyInput {
  companyId: string;
  partyId: string;
  bankAccountId: string;
  date: string;
  amount: number;
  method: string;
  reference?: string;
  allocations: { invoice_id: string; amount: number }[];
  notes?: string;
}

/** Records a supplier payment or customer receipt, allocates it, moves the bank and writes the journal. */
export function useRecordMoney(kind: "payment" | "receipt") {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: RecordMoneyInput) =>
      untypedRpc<string>(kind === "payment" ? "record_supplier_payment" : "record_customer_receipt", {
        p_company_id: v.companyId,
        [kind === "payment" ? "p_supplier_id" : "p_customer_id"]: v.partyId,
        p_bank_account_id: v.bankAccountId,
        [kind === "payment" ? "p_payment_date" : "p_receipt_date"]: v.date,
        p_amount: v.amount,
        p_method: v.method,
        p_reference: v.reference || null,
        p_allocations: v.allocations.filter((a) => a.amount > 0),
        p_notes: v.notes || null,
      }),
    onSuccess: () => { refresh(); toast.success(kind === "payment" ? "Payment recorded" : "Receipt recorded"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
