import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { untypedRpc } from "@/lib/untypedRpc";
import type { PoAmendment, CreatePoAmendmentData } from "@/types/purchaseOrder";

// Amendments are requested and decided through database functions
// (migration 20260928130000). They are numbered per PO (PO-…-A1), record the
// before/after values, and change the PO only when approved.

const SELECT = `
  *,
  approver_profile:profiles!po_amendments_approved_by_fkey(full_name, email),
  purchase_order:purchase_orders(id, po_number, status, currency, supplier:suppliers(name))
`;

function refresh(qc: QueryClient, poId?: string) {
  qc.invalidateQueries({ queryKey: ["po-amendments"] });
  qc.invalidateQueries({ queryKey: ["po-amendment-block-reason"] });
  qc.invalidateQueries({ queryKey: ["purchase-orders"] });
  if (poId) qc.invalidateQueries({ queryKey: ["purchase-order", poId] });
}

export function usePoAmendments(poId: string) {
  return useQuery({
    queryKey: ["po-amendments", poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_amendments")
        .select(SELECT)
        .eq("po_id", poId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PoAmendment[];
    },
    enabled: !!poId,
  });
}

/** Amendments on the selected company's purchase orders, newest first. */
export function useCompanyPoAmendments(companyId: string | undefined) {
  return useQuery({
    queryKey: ["po-amendments", "company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_amendments")
        .select(SELECT.replace("purchase_order:purchase_orders(", "purchase_order:purchase_orders!inner("))
        .eq("purchase_order.company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as PoAmendment[];
    },
    enabled: !!companyId,
  });
}

/** Why the signed-in user can't decide this amendment, or null if they can. */
export function usePoAmendmentBlockReason(amendmentId: string, pending: boolean) {
  return useQuery({
    queryKey: ["po-amendment-block-reason", amendmentId],
    queryFn: () => untypedRpc<string | null>("po_amendment_block_reason", { p_amendment_id: amendmentId }),
    enabled: !!amendmentId && pending,
    staleTime: 30_000,
  });
}

export function useCreatePoAmendment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePoAmendmentData) =>
      untypedRpc<string>("request_po_amendment", {
        p_po_id: data.po_id,
        p_type: data.amendment_type,
        p_reason: data.reason,
        p_notes: data.notes ?? null,
        p_changes: data.changes ?? null,
      }),
    onSuccess: (_, variables) => {
      refresh(qc, variables.po_id);
      toast.success("Amendment requested. It changes the PO once approved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDecidePoAmendment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, comments }: { id: string; poId: string; approve: boolean; comments?: string }) =>
      untypedRpc<null>("decide_po_amendment", { p_amendment_id: id, p_approve: approve, p_comments: comments || null }),
    onSuccess: (_, { poId, approve }) => {
      refresh(qc, poId);
      toast.success(approve ? "Amendment approved and applied to the PO" : "Amendment rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
