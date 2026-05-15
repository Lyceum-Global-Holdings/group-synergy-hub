import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface PartialImportRow {
  item_code: string;
  location_code: string;
  bin_code: string;
  quantity: number | string;
  secondary_quantity?: number | string | null;
  batch_number?: string | null;
  manufacture_date?: string | null;
  expiry_date?: string | null;
  unit_cost?: number | string | null;
  received_at?: string | null;
  reference?: string | null;
  notes?: string | null;
  mode?: "add" | "set";
}

export interface ImportResult {
  ok: boolean;
  inserted: number;
  updated: number;
  batches_created: number;
  bins_created: number;
}

export function useImportPartialQuantities() {
  const qc = useQueryClient();
  const { selectedCompany } = useCompany();
  return useMutation({
    mutationFn: async (input: {
      rows: PartialImportRow[];
      allow_create_bin?: boolean;
    }) => {
      if (!selectedCompany?.id) throw new Error("No company selected");
      const { data, error } = await supabase.rpc("import_partial_quantities", {
        p_company_id: selectedCompany.id,
        p_rows: input.rows as unknown as never,
        p_allow_create_bin: input.allow_create_bin ?? false,
      });
      if (error) throw error;
      return data as unknown as ImportResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partial-quantities"] });
      qc.invalidateQueries({ queryKey: ["warehouse-bin-allocations"] });
      qc.invalidateQueries({ queryKey: ["warehouse-items"] });
      qc.invalidateQueries({ queryKey: ["all-items-location-stock"] });
    },
  });
}
