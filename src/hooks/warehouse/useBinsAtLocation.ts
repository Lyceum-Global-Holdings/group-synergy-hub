import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BinAtLocation {
  id: string;
  bin_code: string;
  name: string | null;
  bin_type_id: string | null;
  location_id: string;
  status: string | null;
  capacity: number | null;
  current_quantity: number | null;
  company_id: string | null;
  parent_bin_id: string | null;
}

/**
 * Exact-node bin lookup for write paths (putaway, add-stock, transfer destination).
 * Returns ONLY bins physically attached to `locationId` — no ancestor inheritance.
 *
 * SAP EWM / Oracle WMS / GS1 SGLN discipline: a Storage Bin is addressed at the
 * exact Storage Type / Section it lives in. Stock must never be posted to a
 * parent node just because the bin code matches there.
 */
export function useBinsAtLocation(locationId: string | null | undefined) {
  return useQuery({
    queryKey: ["bins-at-location-exact", locationId],
    enabled: !!locationId,
    queryFn: async (): Promise<BinAtLocation[]> => {
      const { data, error } = await supabase.rpc(
        "list_bins_at_location" as any,
        { p_location_id: locationId as string },
      );
      if (error) throw error;
      return (data ?? []) as BinAtLocation[];
    },
  });
}
