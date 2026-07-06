import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CostumeUnit } from "@/types/costumeRental";

export interface StockUnit extends CostumeUnit {
  costume?: { id: string; name: string; costume_code: string; image_url: string | null } | null;
}

// Every physical unit in a company, with its parent costume — the data behind
// the fleet-wide Stock & Maintenance view.
export function useCostumeStock(companyId?: string) {
  const { data: units = [], isLoading, error } = useQuery({
    queryKey: ["costume-stock", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rental_costume_units")
        .select("*, costume:rental_costumes(id, name, costume_code, image_url)")
        .eq("company_id", companyId)
        .order("unit_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StockUnit[];
    },
  });
  return { units, isLoading, error };
}
