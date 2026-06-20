import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MinIssuedBin {
  bin_id: string;
  bin_code: string;
  location_id: string;
  quantity: number;
}

/**
 * Returns the bins a MIN line was originally issued from, ordered by qty desc.
 * Used to pre-fill the "Return to bin" selector on the MRN dialog so the
 * default destination matches the source bin (SAP EWM mvt 653/655 pattern).
 */
export function useMinIssuedBins(
  minId: string | null | undefined,
  itemId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["min-issued-bins", minId, itemId],
    enabled: !!minId && !!itemId,
    staleTime: 60_000,
    queryFn: async (): Promise<MinIssuedBin[]> => {
      const { data, error } = await supabase.rpc("get_min_issued_bins" as any, {
        p_min_id: minId,
        p_item_id: itemId,
      });
      if (error) throw error;
      return (data ?? []) as MinIssuedBin[];
    },
  });
}
