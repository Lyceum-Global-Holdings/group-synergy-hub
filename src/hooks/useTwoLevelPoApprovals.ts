import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/edgeFunctionClient";
import { untypedRpc } from "@/lib/untypedRpc";

// Purchase-order approval runs through checked database functions
// (migration 20260928130000): the database decides who may approve at each
// level, so the buttons only reflect what it will allow.

type Level = "merchandiser" | "department_head";

function refreshPo(qc: QueryClient, poId: string) {
  qc.invalidateQueries({ queryKey: ["purchase-orders"] });
  qc.invalidateQueries({ queryKey: ["purchase-order", poId] });
  qc.invalidateQueries({ queryKey: ["po-approvals", poId] });
  qc.invalidateQueries({ queryKey: ["po-approval-block-reason", poId] });
}

const fail = (title: string) => (error: Error) =>
  toast({ title, description: error.message, variant: "destructive" });

/**
 * Why the signed-in user can't approve or reject this PO right now, or null if
 * they can. Only asked while the PO is waiting for approval.
 */
export const usePoApprovalBlockReason = (poId: string, status: string | undefined) => {
  const pending = status === "pending_approval" || status === "pending_dept_head_approval";
  return useQuery({
    queryKey: ["po-approval-block-reason", poId, status],
    queryFn: () => untypedRpc<string | null>("po_approval_block_reason", { p_po_id: poId }),
    enabled: !!poId && pending,
    staleTime: 30_000,
  });
};

export const useSubmitForMerchandiserApproval = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ poId }: { poId: string }) => untypedRpc<null>("submit_po_for_approval", { p_po_id: poId }),
    onSuccess: (_, { poId }) => {
      refreshPo(qc, poId);
      toast({ title: "Submitted", description: "The PO is waiting for merchandiser approval." });
    },
    onError: fail("Couldn't submit the PO"),
  });
};

/** Approve at whichever level the PO is waiting for. */
export const useApprovePo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ poId, comments }: { poId: string; comments?: string }) =>
      untypedRpc<string>("decide_po_approval", { p_po_id: poId, p_approve: true, p_comments: comments || null }),
    onSuccess: (status, { poId }) => {
      refreshPo(qc, poId);
      toast({
        title: "Approved",
        description:
          status === "approved"
            ? "The PO is fully approved and can be sent to the supplier."
            : "The PO now waits for department head approval.",
      });
    },
    onError: fail("Couldn't approve the PO"),
  });
};

export const useApprovePOAsMerchandiser = useApprovePo;
export const useApprovePOAsDeptHead = useApprovePo;

export const useRejectPO = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ poId, reason }: { poId: string; reason: string; approvalLevel?: Level }) =>
      untypedRpc<string>("decide_po_approval", { p_po_id: poId, p_approve: false, p_comments: reason }),
    onSuccess: (_, { poId }) => {
      refreshPo(qc, poId);
      toast({ title: "PO rejected", description: "The creator can revise it and submit again." });
    },
    onError: fail("Couldn't reject the PO"),
  });
};

/** Pull a pending PO back to draft so its lines can be edited (clears approvals). */
export const useWithdrawPo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ poId }: { poId: string }) => {
      const { error } = await supabase.from("purchase_orders").update({ status: "draft" }).eq("id", poId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { poId }) => {
      refreshPo(qc, poId);
      toast({ title: "Withdrawn", description: "The PO is back in draft. Submit it again when it's ready." });
    },
    onError: fail("Couldn't withdraw the PO"),
  });
};

export const useSendDeptHeadApprovalEmail = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ poId, deptHeadEmail, approvalLevel = "department_head" }: {
      poId: string; poNumber?: string; deptHeadEmail: string; approvalLevel?: Level;
    }) => {
      const { data, error, suggestion } = await invokeEdgeFunction("po-email-approval", {
        body: { action: "send_email", po_id: poId, approver_email: deptHeadEmail, approval_level: approvalLevel },
      });
      if (error) throw new Error(suggestion || error.message || "Failed to send the approval email");
      return data as { message?: string };
    },
    onSuccess: (data, { poId }) => {
      refreshPo(qc, poId);
      toast({ title: "Email sent", description: data?.message || "Approval email sent" });
    },
    onError: fail("Couldn't send the approval email"),
  });
};
