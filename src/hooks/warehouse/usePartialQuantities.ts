import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useRealtimeStockUpdates } from "@/hooks/useRealtimeStockUpdates";

export interface PartialQuantityRow {
  allocation_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  base_uom: string | null;
  secondary_uom: string | null;
  track_secondary_quantity: boolean;
  is_batch_tracked: boolean;
  location_id: string | null;
  location_name: string | null;
  bin_id: string;
  bin_code: string;
  allocated_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  secondary_quantity: number | null;
  unit_cost: number | null;
  total_value: number | null;
  fifo_rank: number;
  updated_at: string;
}

export function usePartialQuantities(search: string, limit = 500) {
  useRealtimeStockUpdates();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const companyId = selectedCompany?.id ?? null;

  return useQuery({
    queryKey: ["partial-quantities", companyId, globalLocationId, search, limit],
    enabled: !!companyId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_partial_quantities", {
        p_company_id: companyId!,
        p_location_id: globalLocationId,
        p_search: search?.trim() || null,
        p_limit: limit,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as PartialQuantityRow[];
    },
  });
}

export interface IssuePartialInput {
  allocation_id: string;
  quantity: number;
  secondary_quantity?: number | null;
  reason_code: string;
  reference?: string | null;
  notes?: string | null;
}

export function useIssuePartialQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IssuePartialInput) => {
      const { data, error } = await supabase.rpc("issue_partial_quantity", {
        p_allocation_id: input.allocation_id,
        p_quantity: input.quantity,
        p_secondary_quantity: input.secondary_quantity ?? null,
        p_reason_code: input.reason_code,
        p_reference: input.reference ?? null,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; transaction_id: string; remaining_quantity: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partial-quantities"] });
      qc.invalidateQueries({ queryKey: ["warehouse-bin-allocations"] });
      qc.invalidateQueries({ queryKey: ["warehouse-items"] });
      qc.invalidateQueries({ queryKey: ["all-items-location-stock"] });
    },
  });
}
