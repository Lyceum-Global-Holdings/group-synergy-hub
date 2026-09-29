import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { untypedRpc } from "@/lib/untypedRpc";

export interface ProductionOutputStatus {
  /** Good output: what the last stage produced. */
  output: number;
  /** The finished good the order produces, when it can be told. */
  finished_good: { id: string; name: string; code: string } | null;
  /** The production receipt created from this order, if any. */
  receipt: { id: string; batch_number: string; quantity: number; approval_status: "pending" | "approved" | "rejected" } | null;
}

export function useProductionOutputStatus(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["production-output-status", orderId],
    queryFn: () => untypedRpc<ProductionOutputStatus>("production_output_status", { p_order_id: orderId }),
    enabled,
  });
}

/** Creates the production receipt (pending approval) for a completed order. */
export function usePostProductionOutput() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, finishedGoodId }: { orderId: string; finishedGoodId?: string }) =>
      untypedRpc<string>("post_production_output", { p_order_id: orderId, p_finished_good_id: finishedGoodId ?? null }),
    onSuccess: (_id, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["production-output-status", orderId] });
      qc.invalidateQueries({ queryKey: ["finished-goods-batches"] });
      toast.success("Output sent to finished goods for approval");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
