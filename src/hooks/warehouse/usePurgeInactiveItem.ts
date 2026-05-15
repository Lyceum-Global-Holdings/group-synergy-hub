import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PurgeArgs {
  itemId: string;
  reason: string;
}

interface BulkPurgeArgs {
  itemIds: string[];
  reason: string;
}

interface BulkRow {
  id: string;
  status: "purged" | "blocked";
  message: string | null;
}

export interface PurgeEligibilityRow {
  id: string;
  item_code: string;
  eligible: boolean;
  current_stock: number;
  blocking_refs: string[] | null;
}

function invalidateInventoryQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["warehouse-items-inventory"] });
  qc.invalidateQueries({ queryKey: ["warehouse-items"] });
  qc.invalidateQueries({ queryKey: ["warehouse-inventory-page"] });
  qc.invalidateQueries({ queryKey: ["warehouse-items-catalog-ids"] });
  qc.invalidateQueries({ queryKey: ["warehouse-bin-allocations"] });
}

export function useCheckPurgeEligibility(itemIds: string[], enabled = true) {
  return useQuery({
    queryKey: ["purge-eligibility", [...itemIds].sort().join(",")],
    enabled: enabled && itemIds.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "check_inventory_purge_eligibility" as never,
        { p_item_ids: itemIds } as never,
      );
      if (error) throw error;
      return (data ?? []) as PurgeEligibilityRow[];
    },
  });
}

export function usePurgeInactiveItem() {
  const qc = useQueryClient();

  const single = useMutation({
    mutationFn: async ({ itemId, reason }: PurgeArgs) => {
      const { data, error } = await supabase.rpc(
        "purge_inactive_inventory_item" as never,
        { p_item_id: itemId, p_reason: reason } as never,
      );
      if (error) throw error;
      return data as { id: string; item_code: string; status: string };
    },
    onSuccess: (data) => {
      toast.success(`Purged ${data.item_code}`);
      invalidateInventoryQueries(qc);
    },
    onError: (e: Error) => {
      toast.error("Purge blocked", { description: e.message });
    },
  });

  const bulk = useMutation({
    mutationFn: async ({ itemIds, reason }: BulkPurgeArgs) => {
      const { data, error } = await supabase.rpc(
        "purge_inactive_inventory_items_bulk" as never,
        { p_item_ids: itemIds, p_reason: reason } as never,
      );
      if (error) throw error;
      return (data ?? []) as BulkRow[];
    },
    onSuccess: (rows) => {
      const purged = rows.filter((r) => r.status === "purged").length;
      const blocked = rows.length - purged;
      if (blocked === 0) toast.success(`Purged ${purged} items`);
      else toast.warning(`Purged ${purged}, blocked ${blocked}`, {
        description: rows
          .filter((r) => r.status === "blocked")
          .slice(0, 3)
          .map((r) => r.message)
          .join("\n"),
      });
      invalidateInventoryQueries(qc);
    },
    onError: (e: Error) => {
      toast.error("Bulk purge failed", { description: e.message });
    },
  });

  return {
    purgeItem: single.mutateAsync,
    purgeItemsBulk: bulk.mutateAsync,
    isPurging: single.isPending || bulk.isPending,
  };
}
