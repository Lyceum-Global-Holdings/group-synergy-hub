import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InheritedBin {
  id: string;
  bin_code: string;
  name: string | null;
  bin_type_id: string | null;
  location_id: string;
  inherited_from_location_id: string | null;
  inherited_from_location_name: string | null;
  status: string | null;
  capacity: number | null;
  current_quantity: number | null;
  is_global_template: boolean | null;
  company_id: string | null;
}

/**
 * Returns active bins physically attached to the given location.
 *
 * SAP EWM / Oracle WMS / GS1 SGLN discipline: a Storage Bin is addressed at
 * its exact storage node. Stock must never be posted to a parent/root just
 * because the bin code matches there. Returned `inherited_from_*` fields are
 * always null and exist only for backward shape compatibility with callers.
 */
export function useBinsForLocation(locationId: string | null | undefined) {
  return useQuery({
    queryKey: ["bins-at-location-exact", locationId],
    enabled: !!locationId,
    queryFn: async (): Promise<InheritedBin[]> => {
      const { data, error } = await supabase.rpc(
        "list_bins_at_location" as any,
        { p_location_id: locationId as string },
      );
      if (error) throw error;
      return ((data ?? []) as any[]).map((b) => ({
        id: b.id,
        bin_code: b.bin_code,
        name: b.name,
        bin_type_id: b.bin_type_id,
        location_id: b.location_id,
        inherited_from_location_id: null,
        inherited_from_location_name: null,
        status: b.status,
        capacity: b.capacity,
        current_quantity: b.current_quantity,
        is_global_template: null,
        company_id: b.company_id,
      }));
    },
  });
}
