import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Canonical query keys that depend on warehouse stock state.
 *
 * Any code path that mutates stock (transfers, moves, adjustments, GRN
 * allocation, bulk uploads, scanned bin adjustments, etc.) MUST invalidate
 * this entire set so that every list/grid/picker reflects the new state.
 *
 * Centralising this prevents the "I forgot to invalidate key X" class of
 * bug where the DB is correct but a specific screen shows stale data.
 */
export const WAREHOUSE_STOCK_QUERY_KEYS = [
  ["warehouse-items"],
  ["warehouse-items-inventory"],
  ["warehouse-bin-allocations"],
  ["all-items-location-stock"],
  ["stock-transactions"],
  ["stock-transfer-requests"],
  ["warehouse-catalog"],
  ["warehouse-locations-stock"],
  ["tool-bin-allocations"],
  ["tool-bin-allocations-all"],
  ["warehouse-tools"],
] as const;

export function useInvalidateWarehouseStock() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    for (const key of WAREHOUSE_STOCK_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: key as unknown as string[] });
    }
  }, [queryClient]);
}
