import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { RfqRfpItem, RfqRfpRequest, SupplierQuote } from "@/types/rfqRfp";

// Supplier-portal data. Row security (migration 20260928090000) limits every
// query to the signed-in user's supplier: invited RFQs, own quotes, POs sent to
// them and their invoices.

export interface PortalRfq {
  invitation_status: string;
  request: RfqRfpRequest & { items: RfqRfpItem[] };
}

export function usePortalRfqs(supplierId: string | null) {
  return useQuery({
    queryKey: ["portal-rfqs", supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<PortalRfq[]> => {
      const { data, error } = await supabase
        .from("rfq_rfp_invited_suppliers")
        .select("invitation_status, request:rfq_rfp_requests(*, items:rfq_rfp_items(*))")
        .eq("supplier_id", supplierId!);
      if (error) throw error;
      // Drafts are hidden by row security, so their request comes back empty.
      return ((data ?? []) as unknown as PortalRfq[])
        .filter((r) => r.request)
        .sort((a, b) => (b.request.submission_deadline ?? "").localeCompare(a.request.submission_deadline ?? ""));
    },
  });
}

export function usePortalQuotes(supplierId: string | null) {
  return useQuery({
    queryKey: ["portal-quotes", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_quotes")
        .select("*, items:supplier_quote_items(*), request:rfq_rfp_requests(request_number, title)")
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<SupplierQuote & { request: { request_number: string; title: string } | null }>;
    },
  });
}

export interface PortalPo {
  id: string;
  po_number: string;
  po_date: string;
  status: string;
  currency: string | null;
  final_amount: number | null;
  total_amount: number | null;
  items: Array<{ id: string; item_name: string; item_code: string | null; quantity_ordered: number; unit_of_measure: string; unit_price: number }>;
}

export function usePortalPurchaseOrders(supplierId: string | null) {
  return useQuery({
    queryKey: ["portal-pos", supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<PortalPo[]> => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, po_date, status, currency, final_amount, total_amount, items:po_items(id, item_name, item_code, quantity_ordered, unit_of_measure, unit_price)")
        .eq("supplier_id", supplierId!)
        .in("status", ["sent", "acknowledged", "partially_received", "completed"])
        .order("po_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PortalPo[];
    },
  });
}

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  currency: string | null;
  gross_amount: number | null;
  amount_paid: number | null;
  status: string;
  three_way_match_status: string | null;
  po: { po_number: string } | null;
}

export function usePortalApInvoices(supplierId: string | null) {
  return useQuery({
    queryKey: ["portal-ap-invoices", supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<PortalInvoice[]> => {
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("id, invoice_number, invoice_date, due_date, currency, gross_amount, amount_paid, status, three_way_match_status, po:purchase_orders(po_number)")
        .eq("supplier_id", supplierId!)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PortalInvoice[];
    },
  });
}

export interface SubmitInvoiceInput {
  poId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  lines: Array<{ description: string; quantity: number; unit_price: number }>;
  taxAmount: number;
  notes?: string;
}

export function useSubmitInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitInvoiceInput) => {
      const { data, error } = await (supabase as unknown as {
        rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: string; error: { message: string } | null }>;
      }).rpc("submit_supplier_invoice", {
        p_po_id: input.poId,
        p_invoice_number: input.invoiceNumber,
        p_invoice_date: input.invoiceDate,
        p_due_date: input.dueDate || null,
        p_lines: input.lines.map((l) => ({ description: l.description, quantity: String(l.quantity), unit_price: String(l.unit_price) })),
        p_tax_amount: input.taxAmount,
        p_notes: input.notes || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-ap-invoices"] });
      toast.success("Invoice submitted", { description: "The buyer's finance team will review it against the purchase order." });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
