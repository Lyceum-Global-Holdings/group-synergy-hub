import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDashboardLocationData = (locationId: string | null) => {
  const inventoryQuery = useQuery({
    queryKey: ["dashboard-inventory-by-location", locationId],
    queryFn: async () => {
      // Serial-tracked items (machines) — count by current_location_id
      let serialQuery = supabase
        .from("construction_serial_numbers")
        .select("id, item_master_id, condition", { count: "exact" });

      if (locationId) {
        serialQuery = serialQuery.eq("current_location_id", locationId);
      }

      const { count: serialCount, data: serials } = await serialQuery;

      // Bulk stock items — sum quantity by location
      let stockQuery = supabase
        .from("construction_inventory_stock")
        .select("quantity, item_master_id");

      if (locationId) {
        stockQuery = stockQuery.eq("location_id", locationId);
      }

      const { data: stockRows } = await stockQuery;

      const totalBulkQty = (stockRows || []).reduce(
        (sum, r) => sum + Number(r.quantity || 0),
        0
      );

      // Condition breakdown from serials
      const conditionMap: Record<string, number> = {};
      (serials || []).forEach((s) => {
        const c = s.condition || "Unknown";
        conditionMap[c] = (conditionMap[c] || 0) + 1;
      });

      return {
        serialCount: serialCount || 0,
        bulkItemCount: stockRows?.length || 0,
        totalBulkQty: Math.round(totalBulkQty),
        conditionBreakdown: conditionMap,
      };
    },
  });

  const labourQuery = useQuery({
    queryKey: ["dashboard-labour-by-location", locationId],
    queryFn: async () => {
      let query = supabase
        .from("construction_labour_master")
        .select("id, status, trade", { count: "exact" });

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { count, data } = await query;

      const activeCount = (data || []).filter(
        (w) => w.status === "Active"
      ).length;

      // Trade breakdown
      const tradeMap: Record<string, number> = {};
      (data || []).forEach((w) => {
        const t = w.trade || "Unassigned";
        tradeMap[t] = (tradeMap[t] || 0) + 1;
      });

      return {
        totalLabour: count || 0,
        activeLabour: activeCount,
        tradeBreakdown: tradeMap,
      };
    },
  });

  return {
    inventory: inventoryQuery.data,
    labour: labourQuery.data,
    isLoading: inventoryQuery.isLoading || labourQuery.isLoading,
  };
};
