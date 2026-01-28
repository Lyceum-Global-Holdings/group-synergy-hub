import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface SendForRepairData {
  locationId: string;
  repairCentre: string;
  itemMasterId: string;
  quantity: number;
  serialNumberIds: string[];
  issueDescription?: string;
  notes?: string;
}

export function useSendForRepair() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: SendForRepairData) => {
      const { data: user } = await supabase.auth.getUser();

      // For each serial number, create a repair record and update the serial
      for (const serialId of data.serialNumberIds) {
        // 1. Create repair record
        const { error: repairError } = await supabase
          .from("construction_repair_records")
          .insert({
            item_master_id: data.itemMasterId,
            serial_number_id: serialId,
            repair_date: new Date().toISOString().split('T')[0],
            status: "sent_for_repair",
            service_provider: data.repairCentre,
            issue_description: data.issueDescription || null,
            repair_notes: data.notes || null,
            quantity: 1,
            company_id: selectedCompany?.id || null,
            created_by: user?.user?.id || null,
          });

        if (repairError) throw repairError;

        // 2. Update serial number status to under_repair and availability to in_transit
        const { error: serialError } = await supabase
          .from("construction_serial_numbers")
          .update({
            condition: "under_repair",
            availability: "in_transit",
            updated_at: new Date().toISOString(),
          })
          .eq("id", serialId);

        if (serialError) throw serialError;

        // 3. Create transaction record for dashboard history
        const { error: txError } = await supabase
          .from("construction_inventory_transactions")
          .insert({
            item_master_id: data.itemMasterId,
            location_id: data.locationId,
            serial_number_id: serialId,
            transaction_type: "repair_sent",
            quantity: 1,
            transaction_date: new Date().toISOString(),
            reference_number: `REP-${Date.now()}`,
            notes: `Sent to ${data.repairCentre}${data.issueDescription ? ` - ${data.issueDescription}` : ''}`,
            company_id: selectedCompany?.id || null,
            created_by: user?.user?.id || null,
          });

        if (txError) throw txError;
      }

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["construction-repairs"] });
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      
      toast.success("Items sent for repair successfully");
    },
    onError: (error) => {
      console.error("Send for repair error:", error);
      toast.error("Failed to send items for repair");
    },
  });
}
