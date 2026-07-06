import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from "@/hooks/use-toast";
import { RepairStatus } from "@/types/construction-inventory";

interface UpdateRepairStatusData {
  repairId: string;
  newStatus: RepairStatus;
  serialNumberId: string | null;
  originalLocationId?: string | null;
  repairCost?: number | null;
}

export function useUpdateRepairStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateRepairStatusData) => {
      console.log("Updating repair status:", data);

      const user = getCachedUser();
      if (!user) throw new Error("User not authenticated");

      // 1. Update repair record status
      const repairUpdate: Record<string, unknown> = {
        status: data.newStatus,
        updated_at: new Date().toISOString(),
      };

      // If returning to site, set actual return date
      if (data.newStatus === "returned") {
        repairUpdate.actual_return_date = new Date().toISOString();
      }

      // Update repair cost if provided
      if (data.repairCost !== undefined) {
        repairUpdate.repair_cost = data.repairCost;
      }

      const { error: repairError } = await supabase
        .from("construction_repair_records")
        .update(repairUpdate)
        .eq("id", data.repairId);

      if (repairError) {
        console.error("Error updating repair record:", repairError);
        throw repairError;
      }

      // 2. If serial number exists, update its status based on repair status
      if (data.serialNumberId) {
        let serialUpdate: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (data.newStatus === "sent_for_repair" || data.newStatus === "in_repair") {
          serialUpdate.condition = "under_repair";
          serialUpdate.availability = "in_transit";
        } else if (data.newStatus === "repaired") {
          // Still at repair center, ready to return
          serialUpdate.condition = "under_repair";
          serialUpdate.availability = "in_transit";
        } else if (data.newStatus === "returned") {
          // Return to site - item is working and available
          serialUpdate.condition = "working";
          serialUpdate.availability = "available";
          
          // Get the original location from the serial number record
          const { data: repairRecord, error: fetchRepairError } = await supabase
            .from("construction_repair_records")
            .select(`
              serial_number:construction_serial_numbers(
                id,
                current_location_id,
                item_master_id
              )
            `)
            .eq("id", data.repairId)
            .single();
          
          if (!fetchRepairError && repairRecord?.serial_number?.current_location_id) {
            // Location already set, keep it
            console.log("Serial will retain location:", repairRecord.serial_number.current_location_id);
          }
          
          // Log return transaction
          if (repairRecord?.serial_number) {
            const { error: transactionError } = await supabase
              .from("construction_inventory_transactions")
              .insert({
                item_master_id: repairRecord.serial_number.item_master_id,
                location_id: repairRecord.serial_number.current_location_id,
                serial_number_id: data.serialNumberId,
                transaction_type: "repair_returned",
                quantity_change: 1,
                transaction_date: new Date().toISOString(),
                repair_id: data.repairId,
                notes: "Item returned from repair",
                performed_by: user.id,
              });
            
            if (transactionError) {
              console.warn("Failed to log repair return transaction:", transactionError);
            }
          }
        } else if (data.newStatus === "discarded") {
          serialUpdate.condition = "scrap";
          serialUpdate.availability = "available"; // Not in use anymore
        }

        const { error: serialError } = await supabase
          .from("construction_serial_numbers")
          .update(serialUpdate)
          .eq("id", data.serialNumberId);

        if (serialError) {
          console.error("Error updating serial number:", serialError);
          throw serialError;
        }

        console.log("Serial number updated successfully");
      }

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["construction-repairs"] });
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-by-location"] });
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      
      toast({
        title: "Status Updated",
        description: "Repair status has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Failed to update repair status:", error);
      toast({
        title: "Error",
        description: "Failed to update repair status. Please try again.",
        variant: "destructive",
      });
    },
  });
}
