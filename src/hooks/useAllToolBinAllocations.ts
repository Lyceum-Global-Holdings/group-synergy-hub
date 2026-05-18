/**
 * Fetch every tool bin allocation for the active company (or all companies
 * when viewing all). Used by the Warehouse → Bin Allocations and Inventory
 * surfaces to merge tools into the unified on-hand view.
 *
 * Tools live in `warehouse_tools` (not `warehouse_items`), but operationally a
 * "thing in a bin" is the same concept whether it's a tool or a stocked item.
 * Merging at the read layer keeps the rest of the WMS workflows untouched.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { BinAllocationWithDetails } from "@/types/warehouseReservation";

export interface ToolAllocationRow extends BinAllocationWithDetails {
  _entity_type: "tool";
  tool_id: string;
}

export function useAllToolBinAllocations(options?: { disableFetch?: boolean }) {
  const { selectedCompany, isViewingAllCompanies } = useCompany();
  const companyId = isViewingAllCompanies ? null : selectedCompany?.id ?? null;

  return useQuery({
    queryKey: ["tool-bin-allocations-all", companyId, isViewingAllCompanies],
    enabled:
      !options?.disableFetch && (isViewingAllCompanies || !!selectedCompany?.id),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      let q = supabase
        .from("tool_bin_allocations")
        .select(
          `
          id,
          tool_id,
          bin_id,
          allocated_quantity,
          reserved_quantity,
          available_quantity,
          notes,
          company_id,
          created_by,
          created_at,
          updated_at,
          tool:warehouse_tools!tool_id(id, tool_code, name, company_id),
          warehouse_bin:warehouse_bins!bin_id(
            bin_code,
            name,
            location_id,
            warehouse_location:warehouse_locations!warehouse_bins_location_id_fkey(
              id,
              name,
              location_code,
              parent_id,
              parent:warehouse_locations!parent_id(
                id,
                name,
                location_code
              )
            )
          )
        `,
        )
        .gt("allocated_quantity", 0)
        .order("created_at", { ascending: false });

      if (companyId) q = q.eq("company_id", companyId);

      const { data, error } = await q;
      if (error) throw error;

      return (data || []).map((r: any): ToolAllocationRow => ({
        _entity_type: "tool",
        id: r.id,
        tool_id: r.tool_id,
        warehouse_item_id: r.tool_id, // satisfy type shape
        bin_id: r.bin_id,
        allocated_quantity: Number(r.allocated_quantity) || 0,
        reserved_quantity: Number(r.reserved_quantity) || 0,
        available_quantity: Number(r.available_quantity) || 0,
        location_id: r.warehouse_bin?.location_id ?? null,
        notes: r.notes ?? null,
        company_id: r.company_id ?? null,
        created_by: r.created_by ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        warehouse_item: r.tool
          ? { item_code: r.tool.tool_code, name: r.tool.name }
          : undefined,
        warehouse_bin: r.warehouse_bin,
      }));
    },
  });
}
