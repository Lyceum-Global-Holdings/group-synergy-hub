import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { useCompany } from "@/contexts/CompanyContext";

export type ConstructionTransactionType = 
  | 'stock_addition'
  | 'stock_removal'
  | 'transfer'
  | 'adjustment'
  | 'allocation'
  | 'return'
  | 'repair_sent'
  | 'repair_returned'
  | 'new_item';

export interface CreateTransactionData {
  item_id: string;
  transaction_type: ConstructionTransactionType;
  quantity_change: number;
  quantity_before?: number;
  quantity_after?: number;
  from_location_id?: string;
  to_location_id?: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
}

export function useCreateConstructionTransaction() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      const user = { user: getCachedUser() };
      
      const { data: result, error } = await supabase
        .from("construction_inventory_transactions")
        .insert({
          ...data,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-recent-transactions"] });
    },
  });
}
