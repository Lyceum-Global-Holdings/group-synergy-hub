import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export interface CreateTransferData {
  fromLocationId: string;
  toLocationId: string;
  itemMasterId: string;
  quantity: number;
  serialNumberId?: string;
  notes?: string;
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateTransferData) => {
      const { data: user, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user.user) {
        throw new Error("You must be logged in to create transfers");
      }

      if (!selectedCompany?.id) {
        throw new Error("No company selected");
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
          status: "completed", // Auto-complete for now
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

      // 2. Create transfer item
      const { error: itemError } = await supabase
        .from("construction_transfer_items")
        .insert({
          transfer_id: transfer.id,
          item_master_id: data.itemMasterId,
          quantity: data.quantity,
          serial_number_id: data.serialNumberId || null,
        });

      if (itemError) {
        console.error("Transfer item creation error:", itemError);
        throw new Error(`Failed to create transfer item: ${itemError.message}`);
      }

      // 3. Update stock at source location (reduce)
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

      // 4. Update stock at destination location (increase or create)
      const { data: destStock } = await supabase
        .from("construction_inventory_stock")
        .select("*")
        .eq("item_master_id", data.itemMasterId)
        .eq("location_id", data.toLocationId)
        .single();

      if (destStock) {
        // Update existing
        const newQty = destStock.quantity + data.quantity;
        await supabase
          .from("construction_inventory_stock")
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq("id", destStock.id);
      } else {
        // Create new stock record
        await supabase
          .from("construction_inventory_stock")
          .insert({
            item_master_id: data.itemMasterId,
            location_id: data.toLocationId,
            quantity: data.quantity,
            company_id: selectedCompany.id,
          });
      }

      // 5. Log transfer out transaction (from source)
      await supabase.from("construction_inventory_transactions").insert({
        item_master_id: data.itemMasterId,
        transaction_type: "transfer_out",
        quantity_change: -data.quantity,
        location_id: data.fromLocationId,
        transfer_id: transfer.id,
        notes: `Transferred to ${data.toLocationId}: ${data.notes || "N/A"}`,
        company_id: selectedCompany.id,
        performed_by: user.user.id,
      });

      // 6. Log transfer in transaction (to destination)
      await supabase.from("construction_inventory_transactions").insert({
        item_master_id: data.itemMasterId,
        transaction_type: "transfer_in",
        quantity_change: data.quantity,
        location_id: data.toLocationId,
        transfer_id: transfer.id,
        notes: `Transferred from ${data.fromLocationId}: ${data.notes || "N/A"}`,
        company_id: selectedCompany.id,
        performed_by: user.user.id,
      });

      return transfer;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["construction-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      
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
