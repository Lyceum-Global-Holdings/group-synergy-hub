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
 * Returns active bins for a location, including bins inherited from any
 * ancestor location in the warehouse_locations hierarchy.
 *
 * A bin attached to a parent location (e.g. "LNNB") is also visible at every
 * sub-location and department beneath it (e.g. "9th Floor → NGN") — mirroring
 * SAP EWM storage-type / GS1 GLN sub-location inheritance.
 *
 * Bins inherited from an ancestor expose `inherited_from_location_name` so
 * the UI can label them; own bins return null for those fields.
 */
export function useBinsForLocation(locationId: string | null | undefined) {
  return useQuery({
    queryKey: ["bins-for-location-inherited", locationId],
    enabled: !!locationId,
    queryFn: async (): Promise<InheritedBin[]> => {
      const { data, error } = await supabase.rpc(
        "list_bins_for_location_inherited",
        { p_location_id: locationId as string },
      );
      if (error) throw error;
      return (data ?? []) as InheritedBin[];
    },
  });
}
