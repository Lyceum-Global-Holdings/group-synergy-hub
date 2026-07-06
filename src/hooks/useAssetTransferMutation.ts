import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from "@/hooks/use-toast";

interface AssetTransferData {
  assetId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  fromSublocationId: string | null;
  toSublocationId: string | null;
  fromDepartmentId: string | null;
  toDepartmentId: string | null;
  transferReason: string;
  notes?: string;
}

export const useAssetTransferMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (transferData: AssetTransferData) => {
      const user = getCachedUser();
      if (!user) throw new Error("User not authenticated");

      // First, record the transfer in asset_transfers table
      const { error: transferError } = await supabase
        .from("asset_transfers")
        .insert({
          asset_id: transferData.assetId,
          from_location_id: transferData.fromLocationId,
          to_location_id: transferData.toLocationId,
          from_sublocation_id: transferData.fromSublocationId,
          to_sublocation_id: transferData.toSublocationId,
          from_department_id: transferData.fromDepartmentId,
          to_department_id: transferData.toDepartmentId,
          transfer_reason: transferData.transferReason,
          notes: transferData.notes,
          transferred_by: user.id,
        });

      if (transferError) throw transferError;

      // Then update the asset's current location
      const { error: assetError } = await supabase
        .from("warehouse_assets")
        .update({
          location_id: transferData.toLocationId,
          sublocation_id: transferData.toSublocationId,
          department_id: transferData.toDepartmentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transferData.assetId);

      if (assetError) throw assetError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-transfers"] });
      toast({
        title: "Transfer Successful",
        description: "Asset has been transferred to the new location.",
      });
    },
    onError: (error) => {
      console.error("Transfer error:", error);
      toast({
        title: "Transfer Failed",
        description: "Failed to transfer asset. Please try again.",
        variant: "destructive",
      });
    },
  });
};