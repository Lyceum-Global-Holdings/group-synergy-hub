import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { untypedRpc } from "@/lib/untypedRpc";

// Damaged and expired returns are held in their bin (migration 20260928170000)
// until a warehouse manager or admin releases, scraps or returns them.

export interface QuarantineHold {
  hold_id: string;
  item_id: string;
  item_code: string | null;
  item_name: string | null;
  bin_id: string | null;
  bin_code: string | null;
  location_name: string | null;
  quantity_held: number;
  reason: string | null;
  reference_number: string | null;
  held_since: string;
}

export type HoldAction = "release" | "scrap" | "return_to_supplier";

export const useQuarantineHolds = (companyId: string | undefined) =>
  useQuery({
    queryKey: ["quarantine-holds", companyId],
    queryFn: async () => {
      const rows = await untypedRpc<QuarantineHold[]>("list_quarantine_holds", { p_company_id: companyId });
      return (rows ?? []).map((r) => ({ ...r, quantity_held: Number(r.quantity_held) }));
    },
    enabled: !!companyId,
  });

/** Whether the signed-in user may decide on held stock (warehouse manager or admin). */
export const useCanDecideHolds = (userId: string | null | undefined) =>
  useQuery({
    queryKey: ["can-approve-stock-moves", userId],
    queryFn: () => untypedRpc<boolean>("can_approve_stock_moves", { p_user: userId }),
    enabled: !!userId,
    staleTime: 60_000,
  });

const DONE: Record<HoldAction, string> = {
  release: "Released for use",
  scrap: "Scrapped",
  return_to_supplier: "Recorded as returned to the supplier",
};

export const useResolveHold = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ holdId, action, quantity, note }: { holdId: string; action: HoldAction; quantity?: number; note?: string }) =>
      untypedRpc<null>("resolve_quarantine_hold", {
        p_hold_id: holdId,
        p_action: action,
        p_quantity: quantity ?? null,
        p_note: note || null,
      }),
    onSuccess: (_, { action }) => {
      for (const key of ["quarantine-holds", "warehouse-items", "warehouse-bins", "warehouse-bin-allocations", "all-items-location-stock"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      toast.success(DONE[action]);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
