import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  type ItemCategory,
  CATEGORY_PREFIXES,
  SUB_CATEGORIES,
  COLOR_OPTIONS,
  abbreviateItemName,
} from "@/types/construction-inventory";

export function useNextItemCode(
  category: ItemCategory,
  subCategory?: string,
  itemName?: string,
  color?: string
) {
  const { selectedCompany } = useCompany();
  const catPrefix = CATEGORY_PREFIXES[category];
  const subCatCode = SUB_CATEGORIES[category]?.find(s => s.value === subCategory)?.code || "";
  const nameAbbr = abbreviateItemName(itemName || "");
  const colorCode = COLOR_OPTIONS.find(c => c.value === color)?.code || "";

  // Build composite prefix: MAC-HVY-EXCAV-YLW
  const allParts = [catPrefix, subCatCode, nameAbbr, colorCode].filter(Boolean);
  const compositePrefix = allParts.join("-");

  // Only enable when we have at least category + one more field
  const enabled = Boolean(catPrefix && subCatCode && nameAbbr && colorCode);

  return useQuery({
    queryKey: ["next-item-code", selectedCompany?.id, compositePrefix],
    queryFn: async () => {
      let query = supabase
        .from("construction_item_master")
        .select("item_code")
        .eq("category", category)
        .ilike("item_code", `${compositePrefix}-%`);

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      let maxNumber = 0;
      if (data && data.length > 0) {
        data.forEach((item) => {
          // Extract trailing sequence number
          const match = item.item_code.match(new RegExp(`^${compositePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, "i"));
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        });
      }

      const nextNumber = maxNumber + 1;
      return `${compositePrefix}-${nextNumber.toString().padStart(3, "0")}`;
    },
    enabled,
    staleTime: 0,
  });
}
