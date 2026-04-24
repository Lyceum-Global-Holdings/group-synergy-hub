/**
 * useRealtimeStockUpdates — backwards-compat wrapper around the shared
 * realtime bus (see useRealtimeBus). Subscribes to the three tables stock
 * pages care about and dispatches scoped, debounced query invalidations.
 *
 * Stock pages should keep calling this hook; new feature code should use
 * `useRealtimeChannel` directly.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeChannel } from "@/hooks/useRealtimeBus";
import { scheduleInvalidate } from "@/lib/queryInvalidation";

export function useRealtimeStockUpdates() {
  const queryClient = useQueryClient();

  const onBinAllocation = useCallback(
    (payload: any) => {
      const cid = (payload?.new ?? payload?.old)?.company_id;
      scheduleInvalidate(queryClient, ["warehouse-bin-allocations", cid]);
      scheduleInvalidate(queryClient, ["all-items-location-stock", cid]);
      scheduleInvalidate(queryClient, ["warehouse-items"]);
    },
    [queryClient],
  );

  const onBin = useCallback(
    (_payload: any) => {
      scheduleInvalidate(queryClient, ["warehouse-bins"]);
      scheduleInvalidate(queryClient, ["all-items-location-stock"]);
    },
    [queryClient],
  );

  useRealtimeChannel("warehouse_bin_allocations", onBinAllocation);
  useRealtimeChannel("warehouse_bins", onBin);
}
