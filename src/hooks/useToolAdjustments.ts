import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { WarehouseTool, ToolAdjustment } from "@/types/toolManagement";

export interface CreateToolAdjustmentData {
  tool: WarehouseTool;
  adjustmentType: "increase" | "decrease";
  quantity: number;
  reason: string;
  notes?: string;
}

export function useToolAdjustments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: CreateToolAdjustmentData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { tool, adjustmentType, quantity, reason, notes } = data;
      const quantityBefore = tool.total_quantity;
      const quantityAfter = adjustmentType === "increase" 
        ? quantityBefore + quantity 
        : quantityBefore - quantity;

      if (quantityAfter < 0) {
        throw new Error("Cannot decrease quantity below zero");
      }

      const availableBefore = tool.available_quantity;
      const availableAfter = adjustmentType === "increase"
        ? availableBefore + quantity
        : Math.max(0, availableBefore - quantity);

      if (adjustmentType === "decrease" && quantity > tool.available_quantity) {
        throw new Error("Cannot decrease by more than available quantity");
      }

      // Update the tool quantities
      const { error: updateError } = await supabase
        .from("warehouse_tools")
        .update({
          total_quantity: quantityAfter,
          available_quantity: availableAfter,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tool.id);

      if (updateError) throw updateError;

      // Record the adjustment
      const { data: adjustment, error: adjustmentError } = await supabase
        .from("tool_adjustments")
        .insert({
          tool_id: tool.id,
          adjustment_type: adjustmentType,
          quantity_change: quantity,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          reason,
          notes,
          company_id: selectedCompany?.id,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (adjustmentError) throw adjustmentError;
      return adjustment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Success", description: "Tool quantity adjusted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust tool quantity",
        variant: "destructive",
      });
    },
  });

  return {
    adjustToolQuantity: createAdjustmentMutation.mutate,
    isAdjusting: createAdjustmentMutation.isPending,
  };
}
