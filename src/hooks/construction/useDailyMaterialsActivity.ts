import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { flattenCatalog } from '@/lib/flattenWarehouseItem';
import { untypedRpc } from "@/lib/untypedRpc";

export interface DailyMaterialIssue {
  min_number: string;
  issued_to: string | null;
  department: string | null;
  item_code: string | null;
  item_name: string;
  quantity_issued: number;
  item_notes: string | null;
  item_master_notes: string | null;
  supplier_name: string | null;
  supplier_type: string | null;
}

export interface DailyMaterialReturn {
  mrn_number: string;
  returned_by: string | null;
  item_code: string | null;
  item_name: string;
  quantity_returned: number;
  condition: string | null;
  item_notes: string | null;
  item_master_notes: string | null;
}

export interface DailyStockAdjustment {
  transaction_type: string;
  item_code: string | null;
  item_name: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  adjustment_notes: string | null;
  item_master_notes: string | null;
  adjusted_by: string | null;
  issued_to_location_name?: string | null;
  supplier_name: string | null;
  supplier_type: string | null;
}

export interface CurrentStockBalance {
  item_code: string | null;
  item_name: string;
  current_stock: number;
  warehouse_id: string | null;
  warehouse_name: string | null;
}

/**
 * Stock activity for a site report's period. With a project, only the
 * project's warehouses (and issues made for the project) are included;
 * without one, the whole company.
 */
export function useDailyMaterialsActivity(startDate: string | null, endDate?: string | null, projectId?: string | null) {
  const { selectedCompany } = useCompany();
  const effectiveEndDate = endDate || startDate;

  // The project's warehouses and their sub-locations.
  const locationsQuery = useQuery({
    queryKey: ["project-location-ids", projectId],
    queryFn: async () => {
      const rows = await untypedRpc<unknown[]>("project_location_ids", { p_project_id: projectId });
      return (rows ?? []).map((r) => (typeof r === "string" ? r : (Object.values(r as Record<string, string>)[0] ?? ""))).filter(Boolean);
    },
    enabled: !!projectId,
  });
  const locs = projectId ? locationsQuery.data : undefined;
  const scopeReady = !projectId || locationsQuery.isSuccess;
  const scopeKey = projectId ? `${projectId}:${(locs ?? []).length}` : "company";

  // Helper: resolve item master fields (item_code, name, notes, supplier) for a set of warehouse_item IDs.
  // Reads from warehouse_items_full (catalog source of truth) plus suppliers for supplier metadata.
  const resolveItemMaster = async (
    itemIds: string[]
  ): Promise<Record<string, {
    item_code: string | null;
    name: string;
    notes: string | null;
    supplier_name: string | null;
    supplier_type: string | null;
  }>> => {
    const map: Record<string, {
      item_code: string | null;
      name: string;
      notes: string | null;
      supplier_name: string | null;
      supplier_type: string | null;
    }> = {};
    if (itemIds.length === 0) return map;

    const { data: fullRows } = await supabase
      .from("warehouse_items_full")
      .select("id, item_code, name, notes, supplier_id")
      .in("id", itemIds);

    const supplierIds = [
      ...new Set((fullRows || []).map((r: any) => r.supplier_id).filter(Boolean)),
    ] as string[];

    let supplierMap: Record<string, { name: string | null; supplier_type: string | null }> = {};
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id, name, supplier_type")
        .in("id", supplierIds);
      supplierMap = (suppliers || []).reduce((acc: any, s: any) => {
        acc[s.id] = { name: s.name ?? null, supplier_type: s.supplier_type ?? null };
        return acc;
      }, {});
    }

    for (const row of (fullRows || []) as any[]) {
      const sup = row.supplier_id ? supplierMap[row.supplier_id] : null;
      map[row.id] = {
        item_code: row.item_code ?? null,
        name: row.name ?? "Unknown Item",
        notes: row.notes ?? null,
        supplier_name: sup?.name ?? null,
        supplier_type: sup?.supplier_type ?? null,
      };
    }
    return map;
  };

  const issuesQuery = useQuery({
    queryKey: ["daily-material-issues", selectedCompany?.id, startDate, effectiveEndDate, scopeKey],
    queryFn: async (): Promise<DailyMaterialIssue[]> => {
      if (!selectedCompany?.id || !startDate) return [];

      let issueQuery = supabase
        .from("material_issue_notes")
        .select(`
          min_number,
          issued_to,
          department,
          material_issue_items (
            quantity_issued,
            notes,
            item_id
          )
        `)
        .eq("company_id", selectedCompany.id)
        .gte("issue_date", startDate)
        .lte("issue_date", effectiveEndDate!);
      if (projectId) {
        issueQuery = locs && locs.length
          ? issueQuery.or(`project_id.eq.${projectId},location_id.in.(${locs.join(",")})`)
          : (issueQuery as any).eq("project_id", projectId);
      }
      const { data, error } = await issueQuery;

      if (error) throw error;

      const allItemIds: string[] = [];
      data?.forEach((issue: any) => {
        (issue.material_issue_items ?? []).forEach((it: any) => {
          if (it.item_id) allItemIds.push(it.item_id);
        });
      });
      const itemMap = await resolveItemMaster([...new Set(allItemIds)]);

      const issues: DailyMaterialIssue[] = [];
      data?.forEach((issue: any) => {
        (issue.material_issue_items ?? []).forEach((item: any) => {
          const info = itemMap[item.item_id] || {
            item_code: null, name: "Unknown Item", notes: null,
            supplier_name: null, supplier_type: null,
          };
          issues.push({
            min_number: issue.min_number,
            issued_to: issue.issued_to,
            department: issue.department,
            item_code: info.item_code,
            item_name: info.name,
            quantity_issued: item.quantity_issued,
            item_notes: item.notes,
            item_master_notes: info.notes,
            supplier_name: info.supplier_name,
            supplier_type: info.supplier_type,
          });
        });
      });

      return issues;
    },
    enabled: !!selectedCompany?.id && !!startDate && scopeReady,
    staleTime: 0,
  });

  const returnsQuery = useQuery({
    queryKey: ["daily-material-returns", selectedCompany?.id, startDate, effectiveEndDate, scopeKey],
    queryFn: async (): Promise<DailyMaterialReturn[]> => {
      if (!selectedCompany?.id || !startDate) return [];
      if (projectId && !(locs && locs.length)) return [];

      let returnQuery = supabase
        .from("material_return_notes")
        .select(`
          mrn_number,
          returned_by,
          material_return_items (
            quantity_returned,
            condition,
            notes,
            item_id
          )
        `)
        .eq("company_id", selectedCompany.id)
        .gte("return_date", startDate)
        .lte("return_date", effectiveEndDate!);
      if (projectId && locs) returnQuery = (returnQuery as any).in("location_id", locs);
      const { data, error } = await returnQuery;

      if (error) throw error;

      const allItemIds: string[] = [];
      data?.forEach((ret: any) => {
        (ret.material_return_items ?? []).forEach((it: any) => {
          if (it.item_id) allItemIds.push(it.item_id);
        });
      });
      const itemMap = await resolveItemMaster([...new Set(allItemIds)]);

      const returns: DailyMaterialReturn[] = [];
      data?.forEach((ret: any) => {
        (ret.material_return_items ?? []).forEach((item: any) => {
          const info = itemMap[item.item_id] || { item_code: null, name: "Unknown Item", notes: null, supplier_name: null, supplier_type: null };
          returns.push({
            mrn_number: ret.mrn_number,
            returned_by: ret.returned_by,
            item_code: info.item_code,
            item_name: info.name,
            quantity_returned: item.quantity_returned,
            condition: item.condition,
            item_notes: item.notes,
            item_master_notes: info.notes,
          });
        });
      });

      return returns;
    },
    enabled: !!selectedCompany?.id && !!startDate && scopeReady,
    staleTime: 0,
  });

  const adjustmentsQuery = useQuery({
    queryKey: ["daily-stock-adjustments", selectedCompany?.id, startDate, effectiveEndDate, scopeKey],
    queryFn: async (): Promise<DailyStockAdjustment[]> => {
      if (!selectedCompany?.id || !startDate) return [];
      if (projectId && !(locs && locs.length)) return [];

      // Pull ALL stock_transactions for the period (company-scoped). The Daily Site Report
      // needs to surface every stock movement that touched the company on that day —
      // goods receipts, material issues/returns, adjustments, transfers, project moves.
      let txQuery = supabase
        .from("stock_transactions")
        .select(`
          transaction_type,
          quantity_change,
          quantity_before,
          quantity_after,
          notes,
          created_by,
          issued_to_location_id,
          item_id,
          issued_to_location:issued_to_location_id ( name )
        `)
        .eq("company_id", selectedCompany.id)
        .gte("created_at", `${startDate}T00:00:00`)
        .lt("created_at", `${effectiveEndDate}T23:59:59.999`)
        .order("created_at", { ascending: false });
      if (projectId && locs) txQuery = (txQuery as any).in("location_id", locs);
      const { data, error } = await txQuery;

      if (error) throw error;

      const rows = (data ?? []) as any[];

      // Resolve item master via warehouse_items_full
      const itemIds = [...new Set(rows.map((r) => r.item_id).filter(Boolean))] as string[];
      const itemMap = await resolveItemMaster(itemIds);

      // Resolve adjuster names
      const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles_directory")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        if (profilesData) {
          profilesMap = profilesData.reduce((acc: Record<string, string>, p: any) => {
            acc[p.user_id] = p.full_name || p.email || "Unknown";
            return acc;
          }, {});
        }
      }

      return rows.map((adj: any) => {
        const info = itemMap[adj.item_id] || { item_code: null, name: "Unknown Item", notes: null, supplier_name: null, supplier_type: null };
        const displayType = adj.transaction_type === "material_issue" && adj.issued_to_location_id
          ? "sublocation_issue"
          : adj.transaction_type || "adjustment";
        return {
          transaction_type: displayType,
          item_code: info.item_code,
          item_name: info.name,
          quantity_change: Number(adj.quantity_change) || 0,
          quantity_before: Number(adj.quantity_before) || 0,
          quantity_after: Number(adj.quantity_after) || 0,
          adjustment_notes: adj.notes,
          item_master_notes: info.notes,
          adjusted_by: adj.created_by ? profilesMap[adj.created_by] || null : null,
          issued_to_location_name: adj.issued_to_location?.name || null,
          supplier_name: info.supplier_name,
          supplier_type: info.supplier_type,
        };
      });
    },
    enabled: !!selectedCompany?.id && !!startDate && scopeReady,
    staleTime: 0,
  });

  // Current stock balances from bin allocations (per company + warehouse location).
  // Item master fields are resolved via warehouse_items_full.
  const stockBalanceQuery = useQuery({
    queryKey: ["current-stock-balance", selectedCompany?.id, scopeKey],
    queryFn: async (): Promise<CurrentStockBalance[]> => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase
        .from("warehouse_bin_allocations")
        .select(`
          allocated_quantity,
          warehouse_item_id,
          warehouse_bins:bin_id (
            location_id,
            warehouse_locations:location_id ( id, name )
          )
        `)
        .eq("company_id", selectedCompany.id)
        .gt("allocated_quantity", 0);

      if (error) throw error;

      const inScope = projectId ? new Set(locs ?? []) : null;
      const rows = ((data ?? []) as any[]).filter((r) => !inScope || inScope.has(r.warehouse_bins?.location_id));
      const itemIds = [...new Set(rows.map((r) => r.warehouse_item_id).filter(Boolean))] as string[];
      const itemMap = await resolveItemMaster(itemIds);

      const stockMap = new Map<string, CurrentStockBalance>();
      rows.forEach((allocation: any) => {
        const info = itemMap[allocation.warehouse_item_id] || { item_code: null, name: "Unknown Item", notes: null, supplier_name: null, supplier_type: null };
        const warehouseId = allocation.warehouse_bins?.warehouse_locations?.id || "";
        const key = `${info.item_code || allocation.warehouse_item_id}-${warehouseId}`;
        const qty = Number(allocation.allocated_quantity) || 0;
        if (stockMap.has(key)) {
          stockMap.get(key)!.current_stock += qty;
        } else {
          stockMap.set(key, {
            item_code: info.item_code,
            item_name: info.name,
            current_stock: qty,
            warehouse_id: allocation.warehouse_bins?.warehouse_locations?.id || null,
            warehouse_name: allocation.warehouse_bins?.warehouse_locations?.name || null,
          });
        }
      });

      return Array.from(stockMap.values());
    },
    enabled: !!selectedCompany?.id && scopeReady,
    staleTime: 0,
  });

  return {
    issues: issuesQuery.data || [],
    returns: returnsQuery.data || [],
    adjustments: adjustmentsQuery.data || [],
    stockBalances: stockBalanceQuery.data || [],
    isLoading: issuesQuery.isLoading || returnsQuery.isLoading || adjustmentsQuery.isLoading || stockBalanceQuery.isLoading,
    isError: issuesQuery.isError || returnsQuery.isError || adjustmentsQuery.isError || stockBalanceQuery.isError,
  };
}
