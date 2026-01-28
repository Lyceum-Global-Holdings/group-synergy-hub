import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export interface CreateTransferData {
  fromLocationId: string;
  toLocationId: string;
  itemMasterId: string;
  quantity: number;
  serialNumberIds?: string[]; // For serial-tracked items (machines)
  notes?: string;
}

// Module-level mutex to prevent duplicate submissions across component re-renders
let isSubmitting = false;

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateTransferData) => {
      // Strict mutex lock to prevent double submission
      if (isSubmitting) {
        throw new Error("Transfer already in progress");
      }
      isSubmitting = true;

      try {
        const { data: user, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user.user) {
          throw new Error("You must be logged in to create transfers");
        }

        if (!selectedCompany?.id) {
          throw new Error("No company selected");
        }

        const isSerialTransfer = data.serialNumberIds && data.serialNumberIds.length > 0;

        if (isSerialTransfer) {
          // Check if any serial is already in transit or not available at source
          const { data: serialsToCheck, error: serialCheckError } = await supabase
            .from("construction_serial_numbers")
            .select("id, availability, current_location_id, serial_number")
            .in("id", data.serialNumberIds!);

          if (serialCheckError) throw serialCheckError;

          const unavailableSerials = serialsToCheck?.filter(
            s => s.availability !== "available" || s.current_location_id !== data.fromLocationId
          ) || [];

          if (unavailableSerials.length > 0) {
            throw new Error(`${unavailableSerials.length} item(s) are not available at the source location`);
          }
        }

        // Generate transfer number
        const transferNumber = `TRF-${Date.now().toString().slice(-8)}`;

        // 1. Create the transfer record
        const { data: transfer, error: transferError } = await supabase
          .from("construction_inventory_transfers")
          .insert({
            transfer_number: transferNumber,
            from_location_id: data.fromLocationId,
            to_location_id: data.toLocationId,
            status: "completed",
            notes: data.notes || null,
            company_id: selectedCompany.id,
            initiated_by: user.user.id,
            completed_by: user.user.id,
            completed_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (transferError) {
          console.error("Transfer creation error:", transferError);
          throw new Error(`Failed to create transfer: ${transferError.message}`);
        }

        if (isSerialTransfer) {
          // Handle serial-tracked transfers (machines)
          for (const serialId of data.serialNumberIds!) {
            // Create transfer item for each serial - constraint requires ONLY serial_number_id (no quantity)
            const { error: itemError } = await supabase
              .from("construction_transfer_items")
              .insert({
                transfer_id: transfer.id,
                item_master_id: data.itemMasterId,
                quantity: null,
                serial_number_id: serialId,
              });

            if (itemError) {
              console.error("Transfer item creation error:", itemError);
              throw new Error(`Failed to create transfer item: ${itemError.message}`);
            }

            // Update serial number location
            const { error: serialUpdateError } = await supabase
              .from("construction_serial_numbers")
              .update({
                current_location_id: data.toLocationId,
                availability: "available",
                updated_at: new Date().toISOString(),
              })
              .eq("id", serialId);

            if (serialUpdateError) {
              console.error("Serial update error:", serialUpdateError);
              throw new Error(`Failed to update serial location: ${serialUpdateError.message}`);
            }

            // Get serial number for transaction notes
            const { data: serialData } = await supabase
              .from("construction_serial_numbers")
              .select("serial_number")
              .eq("id", serialId)
              .single();

            // Log transfer out transaction
            await supabase.from("construction_inventory_transactions").insert({
              item_master_id: data.itemMasterId,
              serial_number_id: serialId,
              transaction_type: "transfer_out",
              quantity_change: -1,
              location_id: data.fromLocationId,
              transfer_id: transfer.id,
              notes: `Serial ${serialData?.serial_number || serialId} transferred out: ${data.notes || "N/A"}`,
              company_id: selectedCompany.id,
              performed_by: user.user.id,
            });

            // Log transfer in transaction
            await supabase.from("construction_inventory_transactions").insert({
              item_master_id: data.itemMasterId,
              serial_number_id: serialId,
              transaction_type: "transfer_in",
              quantity_change: 1,
              location_id: data.toLocationId,
              transfer_id: transfer.id,
              notes: `Serial ${serialData?.serial_number || serialId} transferred in: ${data.notes || "N/A"}`,
              company_id: selectedCompany.id,
              performed_by: user.user.id,
            });
          }
        } else {
          // Handle quantity-based transfers (non-serial items)
          
          // Create transfer item
          const { error: itemError } = await supabase
            .from("construction_transfer_items")
            .insert({
              transfer_id: transfer.id,
              item_master_id: data.itemMasterId,
              quantity: data.quantity,
              serial_number_id: null,
            });

          if (itemError) {
            console.error("Transfer item creation error:", itemError);
            throw new Error(`Failed to create transfer item: ${itemError.message}`);
          }

          // Update stock at source location (reduce)
          const { data: sourceStock } = await supabase
            .from("construction_inventory_stock")
            .select("*")
            .eq("item_master_id", data.itemMasterId)
            .eq("location_id", data.fromLocationId)
            .single();

          if (sourceStock) {
            const newQty = Math.max(0, sourceStock.quantity - data.quantity);
            await supabase
              .from("construction_inventory_stock")
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq("id", sourceStock.id);
          }

          // Update stock at destination location (increase or create)
          const { data: destStock } = await supabase
            .from("construction_inventory_stock")
            .select("*")
            .eq("item_master_id", data.itemMasterId)
            .eq("location_id", data.toLocationId)
            .single();

          if (destStock) {
            const newQty = destStock.quantity + data.quantity;
            await supabase
              .from("construction_inventory_stock")
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq("id", destStock.id);
          } else {
            await supabase
              .from("construction_inventory_stock")
              .insert({
                item_master_id: data.itemMasterId,
                location_id: data.toLocationId,
                quantity: data.quantity,
                company_id: selectedCompany.id,
              });
          }

          // Log transfer out transaction
          await supabase.from("construction_inventory_transactions").insert({
            item_master_id: data.itemMasterId,
            transaction_type: "transfer_out",
            quantity_change: -data.quantity,
            location_id: data.fromLocationId,
            transfer_id: transfer.id,
            notes: `Transferred ${data.quantity} units out: ${data.notes || "N/A"}`,
            company_id: selectedCompany.id,
            performed_by: user.user.id,
          });

          // Log transfer in transaction
          await supabase.from("construction_inventory_transactions").insert({
            item_master_id: data.itemMasterId,
            transaction_type: "transfer_in",
            quantity_change: data.quantity,
            location_id: data.toLocationId,
            transfer_id: transfer.id,
            notes: `Received ${data.quantity} units: ${data.notes || "N/A"}`,
            company_id: selectedCompany.id,
            performed_by: user.user.id,
          });
        }

        return transfer;
      } finally {
        // Always release the mutex
        isSubmitting = false;
      }
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["construction-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-serial-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      
      toast({ title: "Transfer created successfully" });
    },
    onError: (error: Error) => {
      console.error("Transfer mutation error:", error);
      toast({ 
        title: "Failed to create transfer", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}
