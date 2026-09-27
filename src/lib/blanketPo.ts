import type { BlanketPoItem } from "@/types/blanketPurchaseOrder";

/** Contract price after the line's agreed discount: what releases are ordered at (matches create_bpo_release). */
export const contractPrice = (item: Pick<BlanketPoItem, "unit_price" | "discount_percentage">) =>
  Math.round(Number(item.unit_price) * (1 - Number(item.discount_percentage || 0) / 100) * 10000) / 10000;
