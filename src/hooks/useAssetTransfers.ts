import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssetTransfer {
  id: string;
  asset_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  from_sublocation_id: string | null;
  to_sublocation_id: string | null;
  from_department_id: string | null;
  to_department_id: string | null;
  transfer_date: string;
  transfer_reason: string | null;
  transferred_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useAssetTransfers = (assetId: string | undefined) => {
  return useQuery({
    queryKey: ["asset-transfers", assetId],
    queryFn: async () => {
      if (!assetId) return [];
      
      const { data, error } = await supabase
        .from("asset_transfers")
        .select("*")
        .eq("asset_id", assetId)
        .order("transfer_date", { ascending: false });

      if (error) throw error;
      return data as AssetTransfer[];
    },
    enabled: !!assetId,
  });
};