import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  type ItemCategory,
  CATEGORY_PREFIXES,
  SUB_CATEGORIES,
  abbreviateItemName,
} from "@/types/construction-inventory";

/**
 * Generates next auto item code aligned with GS1 GTIN-13 / ISO/IEC 15459
 * (13-character maximum item identifier).
 *
 * Pattern: {CAT3}{SUB3}-{NAME3}-{NNN}  → e.g. MACHVY-EXC-001 (13 chars)
 *  - CAT3 + SUB3 merged (no internal hyphen) — SAP MM material-group style
 *  - NAME3: first 3 alphanumeric chars of item name
 *  - NNN: zero-padded sequence (001–999), scoped per composite prefix
 *
 * Sequence cap: 999 per bucket. Beyond that we throw a "number range exhausted"
 * error rather than silently produce a 14-char code.
 */
export function useNextItemCode(
  category: ItemCategory,
  subCategory?: string,
  itemName?: string,
  _color?: string
) {
  const { selectedCompany } = useCompany();
  const catPrefix = CATEGORY_PREFIXES[category];
  const subCatCode = SUB_CATEGORIES[category]?.find(s => s.value === subCategory)?.code || "";
  const nameAbbr = abbreviateItemName(itemName || "");

  // Composite prefix: {CAT3}{SUB3}-{NAME3}  → e.g. MACHVY-EXC
  // Cat + Sub are merged (no hyphen) to keep total within the 13-char budget.
  const groupCode = `${catPrefix}${subCatCode}`;
  const compositePrefix = [groupCode, nameAbbr].filter(Boolean).join("-");

  // Only enable when we have at least category + sub-category + name
  const enabled = Boolean(catPrefix && subCatCode && nameAbbr);

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
        const escaped = compositePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const seqRegex = new RegExp(`^${escaped}-(\\d+)$`, "i");
        data.forEach((item) => {
          const match = item.item_code.match(seqRegex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        });
      }

      const nextNumber = maxNumber + 1;

      // GS1 GTIN-13 / ISO/IEC 15459 guard — sequence cap at 999 per bucket.
      // SAP-style "number range exhausted" error surfaces this in the UI toast.
      if (nextNumber > 999) {
        throw new Error(
          `Sequence range exhausted for prefix ${compositePrefix}. ` +
          `Use a different item name to start a new sequence (max 999 per name prefix).`
        );
      }

      return `${compositePrefix}-${nextNumber.toString().padStart(3, "0")}`;
    },
    enabled,
    staleTime: 0,
  });
}
