import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { useRef } from "react";

interface SendForRepairData {
  locationId: string;
  repairCentre: string;
  itemMasterId: string;
  quantity: number;
  serialNumberIds: string[];
  issueDescription?: string;
  notes?: string;
}

// Module-level mutex to prevent duplicate submissions across component re-renders
let isSubmitting = false;

export function useSendForRepair() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: SendForRepairData) => {
      // Strict mutex lock to prevent double submission
      if (isSubmitting) {
        throw new Error("Submission already in progress");
      }
      isSubmitting = true;

      try {
        const { data: user } = await supabase.auth.getUser();

        // First, check if any of the serial numbers already have active repair records
        const { data: existingRepairs, error: checkError } = await supabase
          .from("construction_repair_records")
          .select("serial_number_id")
          .in("serial_number_id", data.serialNumberIds)
          .not("status", "in", '("returned","discarded")');

        if (checkError) throw checkError;

        if (existingRepairs && existingRepairs.length > 0) {
          const alreadyInRepair = existingRepairs.map(r => r.serial_number_id);
          throw new Error(`Some items are already in repair: ${alreadyInRepair.length} item(s) skipped.`);
        }

        // Also verify serials are available (not already in_transit or under_repair)
        const { data: serialsToCheck, error: serialCheckError } = await supabase
          .from("construction_serial_numbers")
          .select("id, availability, condition")
          .in("id", data.serialNumberIds);

        if (serialCheckError) throw serialCheckError;

        const unavailableSerials = serialsToCheck?.filter(
          s => s.availability !== "available" || s.condition === "under_repair"
        ) || [];

        if (unavailableSerials.length > 0) {
          throw new Error(`${unavailableSerials.length} item(s) are not available for repair (already in transit or under repair)`);
        }

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
      } finally {
        // Always release the mutex
        isSubmitting = false;
      }
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
      toast.error(error.message || "Failed to send items for repair");
    },
  });
}
