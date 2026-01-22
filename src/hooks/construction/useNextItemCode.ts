import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { ItemCategory } from "@/types/construction-inventory";

// Prefix mapping for each category
const CATEGORY_PREFIXES: Record<ItemCategory, string> = {
  machines: "MAC",
  tools: "TOL",
  safety: "SAF",
  equipment: "EQP",
  scaffolding: "SCA",
  others: "OTH",
};

export function useNextItemCode(category: ItemCategory) {
  const { selectedCompany } = useCompany();
  const prefix = CATEGORY_PREFIXES[category];

  return useQuery({
    queryKey: ["next-item-code", selectedCompany?.id, category],
    queryFn: async () => {
      // Get all item codes for this category to find the max number
      let query = supabase
        .from("construction_item_master")
        .select("item_code")
        .eq("category", category)
        .ilike("item_code", `${prefix}-%`);

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Find the highest number from existing codes
      let maxNumber = 0;
      if (data && data.length > 0) {
        data.forEach((item) => {
          // Extract number from code like "MAC-006" -> 6
          const match = item.item_code.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });
      }

      // Generate next code with zero-padded number (3 digits)
      const nextNumber = maxNumber + 1;
      const nextCode = `${prefix}-${nextNumber.toString().padStart(3, "0")}`;
      
      return nextCode;
    },
    staleTime: 0, // Always refetch to get latest
  });
}
