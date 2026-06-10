import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AllocatedBinInSubtree {
  id: string;
  bin_code: string;
  name: string | null;
  location_id: string;
  location_path: string | null;
  allocated_qty: number;
}

/**
 * All bins that currently hold stock under the selected location subtree
 * (warehouse + every sub-location / department beneath it).
 *
 * Used by the Stock-on-Hand report bin filter so users can include or exclude
 * bins that live under sub-locations of the picked warehouse — not just bins
 * physically attached to the exact node.
 */
export function useAllocatedBinsInSubtree(
  companyId: string | null | undefined,
  locationId: string | null | undefined,
  itemId?: string | null,
) {
  return useQuery({
    queryKey: [
      "allocated-bins-subtree",
      companyId ?? null,
      locationId ?? null,
      itemId ?? null,
    ],
    enabled: !!companyId,
    queryFn: async (): Promise<AllocatedBinInSubtree[]> => {
      const { data, error } = await supabase.rpc(
        "list_allocated_bins_in_subtree" as never,
        {
          p_company_id: companyId,
          p_location_id: locationId ?? null,
          p_item_id: itemId ?? null,
        } as never,
      );
      if (error) throw error;
      return (data ?? []) as AllocatedBinInSubtree[];
    },
  });
}
