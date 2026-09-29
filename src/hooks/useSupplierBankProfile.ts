import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupplierBankProfile {
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
  updated_at: string;
}

/**
 * The supplier's bank record (supplier_profiles_extended), filled from the
 * registration on approval and kept by the supplier in the portal. Readable by
 * admins and the supplier's procurement and finance staff; null otherwise.
 */
export function useSupplierBankProfile(supplierId?: string) {
  return useQuery({
    queryKey: ["supplier-bank-profile", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_profiles_extended")
        .select("*")
        .eq("supplier_id", supplierId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SupplierBankProfile | null) ?? null;
    },
    enabled: !!supplierId,
  });
}
