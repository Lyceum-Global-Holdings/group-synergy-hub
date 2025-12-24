import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface DailyMaterialIssue {
  min_number: string;
  issued_to: string | null;
  department: string | null;
  item_code: string | null;
  item_name: string;
  quantity_issued: number;
  item_notes: string | null;
  item_master_notes: string | null;
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
  item_code: string | null;
  item_name: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  adjustment_notes: string | null;
  item_master_notes: string | null;
  adjusted_by: string | null;
}

export interface CurrentStockBalance {
  item_code: string | null;
  item_name: string;
  current_stock: number;
  warehouse_id: string | null;
  warehouse_name: string | null;
}

export function useDailyMaterialsActivity(startDate: string | null, endDate?: string | null) {
  const { selectedCompany } = useCompany();
  const effectiveEndDate = endDate || startDate;

  const issuesQuery = useQuery({
    queryKey: ["daily-material-issues", selectedCompany?.id, startDate, effectiveEndDate],
    queryFn: async (): Promise<DailyMaterialIssue[]> => {
      if (!selectedCompany?.id || !startDate) return [];

      let query = supabase
        .from("material_issue_notes")
        .select(`
          min_number,
          issued_to,
          department,
          material_issue_items (
            quantity_issued,
            notes,
            warehouse_items (
              item_code,
              name,
              notes
            )
          )
        `)
        .eq("company_id", selectedCompany.id)
        .gte("issue_date", startDate)
        .lte("issue_date", effectiveEndDate!);

      const { data, error } = await query;

      if (error) throw error;

      // Flatten the data structure
      const issues: DailyMaterialIssue[] = [];
      data?.forEach((issue) => {
        issue.material_issue_items?.forEach((item: any) => {
          issues.push({
            min_number: issue.min_number,
            issued_to: issue.issued_to,
            department: issue.department,
            item_code: item.warehouse_items?.item_code || null,
            item_name: item.warehouse_items?.name || "Unknown Item",
            quantity_issued: item.quantity_issued,
            item_notes: item.notes,
            item_master_notes: item.warehouse_items?.notes || null,
          });
        });
      });

      return issues;
    },
    enabled: !!selectedCompany?.id && !!startDate,
  });

  const returnsQuery = useQuery({
    queryKey: ["daily-material-returns", selectedCompany?.id, startDate, effectiveEndDate],
    queryFn: async (): Promise<DailyMaterialReturn[]> => {
      if (!selectedCompany?.id || !startDate) return [];

      let query = supabase
        .from("material_return_notes")
        .select(`
          mrn_number,
          returned_by,
          material_return_items (
            quantity_returned,
            condition,
            notes,
            warehouse_items (
              item_code,
              name,
              notes
            )
          )
        `)
        .eq("company_id", selectedCompany.id)
        .gte("return_date", startDate)
        .lte("return_date", effectiveEndDate!);

      const { data, error } = await query;

      if (error) throw error;

      // Flatten the data structure
      const returns: DailyMaterialReturn[] = [];
      data?.forEach((ret) => {
        ret.material_return_items?.forEach((item: any) => {
          returns.push({
            mrn_number: ret.mrn_number,
            returned_by: ret.returned_by,
            item_code: item.warehouse_items?.item_code || null,
            item_name: item.warehouse_items?.name || "Unknown Item",
            quantity_returned: item.quantity_returned,
            condition: item.condition,
            item_notes: item.notes,
            item_master_notes: item.warehouse_items?.notes || null,
          });
        });
      });

      return returns;
    },
    enabled: !!selectedCompany?.id && !!startDate,
  });

  const adjustmentsQuery = useQuery({
    queryKey: ["daily-stock-adjustments", selectedCompany?.id, startDate, effectiveEndDate],
    queryFn: async (): Promise<DailyStockAdjustment[]> => {
      if (!selectedCompany?.id || !startDate) return [];

      const { data, error } = await supabase
        .from("stock_transactions")
        .select(`
          quantity_change,
          quantity_before,
          quantity_after,
          notes,
          created_by,
          warehouse_items!inner (
            item_code,
            name,
            notes,
            company_id
          )
        `)
        .eq("warehouse_items.company_id", selectedCompany.id)
        .eq("transaction_type", "adjustment")
        .gte("created_at", `${startDate}T00:00:00`)
        .lt("created_at", `${effectiveEndDate}T23:59:59.999`);

      if (error) throw error;

      // Fetch profiles for all unique created_by user IDs
      const userIds = [...new Set((data || []).map((t: any) => t.created_by).filter(Boolean))] as string[];
      
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.user_id] = profile.full_name || profile.email || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (data || []).map((adj: any) => ({
        item_code: adj.warehouse_items?.item_code || null,
        item_name: adj.warehouse_items?.name || "Unknown Item",
        quantity_change: adj.quantity_change,
        quantity_before: adj.quantity_before,
        quantity_after: adj.quantity_after,
        adjustment_notes: adj.notes,
        item_master_notes: adj.warehouse_items?.notes || null,
        adjusted_by: adj.created_by ? profilesMap[adj.created_by] || null : null,
      }));
    },
    enabled: !!selectedCompany?.id && !!startDate,
  });

  // Query for current stock balances from bin allocations (tracks stock per warehouse correctly)
  const stockBalanceQuery = useQuery({
    queryKey: ["current-stock-balance", selectedCompany?.id],
    queryFn: async (): Promise<CurrentStockBalance[]> => {
      if (!selectedCompany?.id) return [];

      // Fetch stock from bin allocations - this correctly tracks stock per warehouse
      // Use explicit foreign key hints and filter directly on company_id
      const { data, error } = await supabase
        .from("warehouse_bin_allocations")
        .select(`
          allocated_quantity,
          company_id,
          warehouse_items:warehouse_item_id (
            id,
            item_code,
            name
          ),
          warehouse_bins:bin_id (
            location_id,
            warehouse_locations:location_id (
              id,
              name
            )
          )
        `)
        .eq("company_id", selectedCompany.id)
        .gt("allocated_quantity", 0);

      if (error) throw error;

      // Group by item_code + warehouse to aggregate stock
      const stockMap = new Map<string, CurrentStockBalance>();
      
      (data || []).forEach((allocation: any) => {
        const itemCode = allocation.warehouse_items?.item_code || "";
        const warehouseId = allocation.warehouse_bins?.warehouse_locations?.id || "";
        const key = `${itemCode}-${warehouseId}`;
        
        if (stockMap.has(key)) {
          const existing = stockMap.get(key)!;
          existing.current_stock += allocation.allocated_quantity || 0;
        } else {
          stockMap.set(key, {
            item_code: allocation.warehouse_items?.item_code || null,
            item_name: allocation.warehouse_items?.name || "Unknown Item",
            current_stock: allocation.allocated_quantity || 0,
            warehouse_id: allocation.warehouse_bins?.warehouse_locations?.id || null,
            warehouse_name: allocation.warehouse_bins?.warehouse_locations?.name || null,
          });
        }
      });
      
      return Array.from(stockMap.values());
    },
    enabled: !!selectedCompany?.id,
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
