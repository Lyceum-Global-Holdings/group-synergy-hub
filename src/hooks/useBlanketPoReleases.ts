import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { untypedRpc } from "@/lib/untypedRpc";
import type { BlanketPoRelease, CreateBpoReleaseData } from "@/types/blanketPurchaseOrder";

// Releases (call-offs) against a blanket PO run through database functions
// (migration 20260928130000). They are checked against the contract (active,
// in date, quantity and value left, min/max order), and approving one creates
// an approved purchase order at the contract price, received through the
// normal GRN process.

function refresh(qc: QueryClient, bpoId?: string) {
  qc.invalidateQueries({ queryKey: ["bpo-releases"] });
  qc.invalidateQueries({ queryKey: ["bpo-release-block-reason"] });
  qc.invalidateQueries({ queryKey: ["blanket-purchase-orders"] });
  qc.invalidateQueries({ queryKey: ["bpo-summary-stats"] });
  qc.invalidateQueries({ queryKey: ["purchase-orders"] });
  if (bpoId) qc.invalidateQueries({ queryKey: ["blanket-purchase-order", bpoId] });
}

export function useBpoReleases(bpoId: string) {
  return useQuery({
    queryKey: ["bpo-releases", bpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blanket_po_releases")
        .select(`
          *,
          items:blanket_po_release_items(
            *,
            bpo_item:blanket_po_items(item_name, item_code, unit_of_measure)
          ),
          po:purchase_orders(id, po_number, status)
        `)
        .eq("bpo_id", bpoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const releases = (data ?? []) as unknown as BlanketPoRelease[];

      // requested_by / approved_by point at auth.users, so names come from profiles separately.
      const ids = [...new Set(releases.flatMap((r) => [r.requested_by, r.approved_by]).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: people } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
        const byId = new Map((people ?? []).map((p) => [p.user_id, { full_name: p.full_name ?? undefined, email: p.email ?? undefined }]));
        for (const r of releases) {
          if (r.requested_by) r.requested_by_profile = byId.get(r.requested_by);
          if (r.approved_by) r.approved_by_profile = byId.get(r.approved_by);
        }
      }
      return releases;
    },
    enabled: !!bpoId,
  });
}

/** Why the signed-in user can't approve this release, or null if they can. */
export function useBpoReleaseBlockReason(releaseId: string, submitted: boolean) {
  return useQuery({
    queryKey: ["bpo-release-block-reason", releaseId],
    queryFn: () => untypedRpc<string | null>("bpo_release_block_reason", { p_release_id: releaseId }),
    enabled: !!releaseId && submitted,
    staleTime: 30_000,
  });
}

export function useCreateBpoRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBpoReleaseData) =>
      untypedRpc<string>("create_bpo_release", {
        p_bpo_id: data.bpo_id,
        p_lines: data.items.map((i) => ({
          bpo_item_id: i.bpo_item_id,
          quantity: i.quantity_requested,
          delivery_date: i.delivery_date ?? null,
          notes: i.notes ?? null,
        })),
        p_expected_delivery_date: data.expected_delivery_date || null,
        p_delivery_location: data.delivery_location || null,
        p_urgency: data.urgency_level ?? "normal",
        p_notes: data.notes || null,
      }),
    onSuccess: (_, variables) => {
      refresh(qc, variables.bpo_id);
      toast.success("Release submitted for approval");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDecideBpoRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId, approve, comments }: { releaseId: string; bpoId: string; approve: boolean; comments?: string }) =>
      untypedRpc<string | null>("decide_bpo_release", { p_release_id: releaseId, p_approve: approve, p_comments: comments || null }),
    onSuccess: (_, { bpoId, approve }) => {
      refresh(qc, bpoId);
      toast.success(approve ? "Release approved; its purchase order is ready to send" : "Release rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCancelBpoRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId }: { releaseId: string; bpoId: string }) =>
      untypedRpc<null>("cancel_bpo_release", { p_release_id: releaseId }),
    onSuccess: (_, { bpoId }) => {
      refresh(qc, bpoId);
      toast.success("Release withdrawn");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
