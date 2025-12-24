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
}

export function useDailyMaterialsActivity(date: string | null) {
  const { selectedCompany } = useCompany();

  const issuesQuery = useQuery({
    queryKey: ["daily-material-issues", selectedCompany?.id, date],
    queryFn: async (): Promise<DailyMaterialIssue[]> => {
      if (!selectedCompany?.id || !date) return [];

      const { data, error } = await supabase
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
        .eq("issue_date", date);

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
    enabled: !!selectedCompany?.id && !!date,
  });

  const returnsQuery = useQuery({
    queryKey: ["daily-material-returns", selectedCompany?.id, date],
    queryFn: async (): Promise<DailyMaterialReturn[]> => {
      if (!selectedCompany?.id || !date) return [];

      const { data, error } = await supabase
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
        .eq("return_date", date);

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
    enabled: !!selectedCompany?.id && !!date,
  });

  const adjustmentsQuery = useQuery({
    queryKey: ["daily-stock-adjustments", selectedCompany?.id, date],
    queryFn: async (): Promise<DailyStockAdjustment[]> => {
      if (!selectedCompany?.id || !date) return [];

      const { data, error } = await supabase
        .from("stock_transactions")
        .select(`
          quantity_change,
          quantity_before,
          quantity_after,
          notes,
          warehouse_items!inner (
            item_code,
            name,
            notes,
            company_id
          )
        `)
        .eq("warehouse_items.company_id", selectedCompany.id)
        .eq("transaction_type", "adjustment")
        .gte("created_at", `${date}T00:00:00`)
        .lt("created_at", `${date}T23:59:59.999`);

      if (error) throw error;

      return (data || []).map((adj: any) => ({
        item_code: adj.warehouse_items?.item_code || null,
        item_name: adj.warehouse_items?.name || "Unknown Item",
        quantity_change: adj.quantity_change,
        quantity_before: adj.quantity_before,
        quantity_after: adj.quantity_after,
        adjustment_notes: adj.notes,
        item_master_notes: adj.warehouse_items?.notes || null,
      }));
    },
    enabled: !!selectedCompany?.id && !!date,
  });

  return {
    issues: issuesQuery.data || [],
    returns: returnsQuery.data || [],
    adjustments: adjustmentsQuery.data || [],
    isLoading: issuesQuery.isLoading || returnsQuery.isLoading || adjustmentsQuery.isLoading,
    isError: issuesQuery.isError || returnsQuery.isError || adjustmentsQuery.isError,
  };
}
