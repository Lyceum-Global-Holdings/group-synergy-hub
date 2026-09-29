import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { untypedRpc } from "@/lib/untypedRpc";

export type ApprovalItemType =
  | "po"
  | "pr"
  | "bpo_release"
  | "po_amendment"
  | "supplier_registration"
  | "min"
  | "stock_transfer"
  | "customer_po"
  | "social_media_access"
  | "production_receipt"
  | "site_report"
  | "corrective_action";

export const APPROVAL_TYPE_LABEL: Record<ApprovalItemType, string> = {
  po: "Purchase order",
  pr: "Requisition",
  bpo_release: "Blanket PO release",
  po_amendment: "PO amendment",
  supplier_registration: "Supplier registration",
  min: "Material issue",
  stock_transfer: "Stock transfer",
  customer_po: "Customer PO",
  social_media_access: "Social media access",
  production_receipt: "Production receipt",
  site_report: "Site report",
  corrective_action: "Corrective action",
};

export interface ApprovalQueueItem {
  item_type: ApprovalItemType;
  item_id: string;
  reference: string;
  title: string;
  amount: number | null;
  currency: string | null;
  company_id: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  stage: string;
  view_url: string;
}

/**
 * "to_decide": what the signed-in user can approve now, by each module's own
 * rules. "submitted": what they sent that is still waiting.
 */
export function useApprovalQueue(scope: "to_decide" | "submitted") {
  return useQuery({
    queryKey: ["approval-queue", scope],
    queryFn: () => untypedRpc<ApprovalQueueItem[]>("approval_queue", { p_scope: scope }),
    refetchInterval: 60_000,
  });
}

/** Approves or rejects through the module's own database function. */
export function useDecideApprovalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { type: ApprovalItemType; id: string; approve: boolean; comments?: string }) =>
      untypedRpc<string>("decide_approval_item", {
        p_type: v.type,
        p_id: v.id,
        p_approve: v.approve,
        p_comments: v.comments?.trim() || null,
      }),
    onSuccess: (result, v) => {
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
      toast.success(
        !v.approve ? "Rejected"
        : result === "pending_approval" ? "First approval given; it now waits for the final approval"
        : "Approved",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
