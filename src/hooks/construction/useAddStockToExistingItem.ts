import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { assertUserCanEditLocation } from "./locationPermissionGuard";

interface AddStockData {
  item_master_id: string;
  quantity: number;
  location_id: string;
}

export function useAddStockToExistingItem() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: AddStockData) => {
      const authData = { user: getCachedUser() }; const authError = null;
      if (authError || !authData.user) throw new Error("You must be logged in.");
      if (!selectedCompany?.id) throw new Error("No company selected.");

      await assertUserCanEditLocation(authData.user.id, data.location_id);

      // Check if stock record already exists for this item + location
      const { data: existing } = await supabase
        .from("construction_inventory_stock")
        .select("id, quantity")
        .eq("item_master_id", data.item_master_id)
        .eq("location_id", data.location_id)
        .maybeSingle();

      if (existing) {
        // Update existing stock
        const { error } = await supabase
          .from("construction_inventory_stock")
          .update({ quantity: existing.quantity + data.quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Create new stock record
        const { error } = await supabase
          .from("construction_inventory_stock")
          .insert({
            item_master_id: data.item_master_id,
            location_id: data.location_id,
            quantity: data.quantity,
            company_id: selectedCompany.id,
          });
        if (error) throw error;
      }

      // Log transaction
      await supabase.from("construction_inventory_transactions").insert({
        item_master_id: data.item_master_id,
        transaction_type: "stock_addition",
        quantity_change: data.quantity,
        location_id: data.location_id,
        notes: `Added ${data.quantity} units to inventory`,
        company_id: selectedCompany.id,
        performed_by: authData.user.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["construction-item-master"] });
      queryClient.invalidateQueries({ queryKey: ["construction-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["construction-transactions"] });
      toast({ title: "Stock added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add stock", description: error.message, variant: "destructive" });
    },
  });
}
