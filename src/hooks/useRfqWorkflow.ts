import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifySourcing } from "@/lib/sourcingNotify";

// RFQ workflow steps run as checked database functions
// (migration 20260928090000): invite, publish / close / reopen / cancel,
// submit a quote, award (optionally creating a draft PO).

// The functions are newer than the generated types.
const rpc = <T,>(fn: string, args: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }> }).rpc(fn, args);

function refreshRfqData(qc: QueryClient) {
  for (const key of ["rfq-rfp-requests", "rfq-rfp-request", "supplier-quotes", "portal-rfqs", "portal-quotes"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export function useInviteSuppliers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, supplierIds }: { requestId: string; supplierIds: string[] }) => {
      const { data, error } = await rpc<number>("rfq_invite_suppliers", {
        p_request_id: requestId,
        p_supplier_ids: supplierIds,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (added) => {
      refreshRfqData(qc);
      toast.success(added === 1 ? "1 supplier invited" : `${added} suppliers invited`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, supplierId }: { requestId: string; supplierId: string }) => {
      const { error } = await rpc<null>("rfq_remove_invitation", { p_request_id: requestId, p_supplier_id: supplierId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      refreshRfqData(qc);
      toast.success("Invitation removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type RfqAction = "publish" | "close" | "reopen" | "cancel";

const ACTION_DONE: Record<RfqAction, string> = {
  publish: "RFQ published",
  close: "Submissions closed; the RFQ is in evaluation",
  reopen: "RFQ reopened for quotes",
  cancel: "RFQ cancelled",
};

export function useRfqAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: RfqAction }) => {
      const { error } = await rpc<string>("rfq_set_status", { p_request_id: requestId, p_action: action });
      if (error) throw new Error(error.message);
      return { requestId, action };
    },
    onSuccess: async ({ requestId, action }) => {
      refreshRfqData(qc);
      toast.success(ACTION_DONE[action]);
      if (action === "publish") {
        const result = await notifySourcing({ event: "rfq_published", request_id: requestId });
        if (result && result.sent > 0 && !result.failed?.length) {
          toast.success(result.sent === 1 ? "Invitation emailed to 1 supplier" : `Invitations emailed to ${result.sent} suppliers`);
        } else {
          toast.warning("Some suppliers couldn't be emailed", {
            description: result?.failed?.join("; ") || "Check the email settings. Suppliers can still see the RFQ in the portal.",
          });
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface QuoteLineInput {
  rfq_item_id: string;
  unit_price: number | null;
  delivery_days?: number | null;
  notes?: string;
}

export interface SubmitQuoteInput {
  requestId: string;
  supplierId: string;
  lines: QuoteLineInput[];
  paymentTerms?: string;
  deliveryCommitment?: string;
  validityDays?: number;
  warranty?: string;
  notes?: string;
}

export function useSubmitQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitQuoteInput) => {
      const { data, error } = await rpc<string>("submit_supplier_quote", {
        p_request_id: input.requestId,
        p_supplier_id: input.supplierId,
        p_lines: input.lines.map((l) => ({
          rfq_item_id: l.rfq_item_id,
          unit_price: l.unit_price == null ? "" : String(l.unit_price),
          delivery_days: l.delivery_days == null ? "" : String(l.delivery_days),
          notes: l.notes ?? "",
        })),
        p_payment_terms: input.paymentTerms || null,
        p_delivery_commitment: input.deliveryCommitment || null,
        p_validity_days: input.validityDays ?? 30,
        p_warranty: input.warranty || null,
        p_notes: input.notes || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      refreshRfqData(qc);
      toast.success("Quote submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAwardRfq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, createPo }: { quoteId: string; createPo: boolean }) => {
      const { data: poId, error } = await rpc<string | null>("award_rfq", { p_quote_id: quoteId, p_create_po: createPo });
      if (error) throw new Error(error.message);
      let poNumber: string | null = null;
      if (poId) {
        const { data } = await supabase.from("purchase_orders").select("po_number").eq("id", poId).maybeSingle();
        poNumber = data?.po_number ?? null;
      }
      return { poId, poNumber };
    },
    onSuccess: ({ poNumber }) => {
      refreshRfqData(qc);
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("RFQ awarded", {
        description: poNumber
          ? `Draft purchase order ${poNumber} was created. Review and submit it for approval in Procurement › Purchase Orders.`
          : undefined,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
