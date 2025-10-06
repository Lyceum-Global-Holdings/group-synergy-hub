import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SupplierEvaluation } from "@/types/supplierEvaluation";
import { calculateSupplierAnalytics, SupplierAnalytics } from "@/lib/supplierAnalytics";

export const useSupplierAnalytics = () => {
  return useQuery({
    queryKey: ["supplier-analytics"],
    queryFn: async () => {
      // Fetch all evaluations with supplier data and entries
      const { data: evaluations, error } = await supabase
        .from("supplier_evaluations")
        .select(`
          *,
          supplier:suppliers (
            id,
            name,
            supplier_code,
            email,
            phone,
            address_line1,
            status
          ),
          warehouse_item:warehouse_items (
            id,
            item_code,
            name
          ),
          entries:supplier_evaluation_entries (
            id,
            evaluation_id,
            receipt_date,
            po_delivery_date,
            po_number,
            warehouse_item_id,
            quality_score,
            punctuality_score,
            total_score,
            passed_first_time,
            passed_after_rework,
            failed_but_accepted,
            failed_returned,
            within_due_date,
            five_days_late,
            within_14_days,
            over_14_days_late,
            notes,
            created_at,
            updated_at,
            warehouse_item:warehouse_items (
              id,
              item_code,
              name
            )
          )
        `)
        .order("evaluation_period_start", { ascending: false });

      if (error) throw error;

      // Group evaluations by supplier
      const supplierEvaluationsMap = new Map<string, SupplierEvaluation[]>();

      evaluations?.forEach((evaluation) => {
        const supplierId = evaluation.supplier_id;
        if (!supplierEvaluationsMap.has(supplierId)) {
          supplierEvaluationsMap.set(supplierId, []);
        }
        supplierEvaluationsMap.get(supplierId)!.push(evaluation as SupplierEvaluation);
      });

      // Calculate analytics for each supplier
      const analytics: SupplierAnalytics[] = [];

      supplierEvaluationsMap.forEach((evaluations) => {
        const supplierAnalytics = calculateSupplierAnalytics(evaluations);
        if (supplierAnalytics) {
          analytics.push(supplierAnalytics);
        }
      });

      // Sort by reliability index (best first)
      analytics.sort((a, b) => b.reliabilityIndex - a.reliabilityIndex);

      return analytics;
    },
  });
};

export const useSupplierEvaluationsBySupplier = (supplierId: string | null) => {
  return useQuery({
    queryKey: ["supplier-evaluations-by-supplier", supplierId],
    queryFn: async () => {
      if (!supplierId) return [];

      const { data, error } = await supabase
        .from("supplier_evaluations")
        .select(`
          *,
          supplier:suppliers (
            id,
            name,
            supplier_code
          ),
          entries:supplier_evaluation_entries (
            id,
            evaluation_id,
            receipt_date,
            po_delivery_date,
            po_number,
            warehouse_item_id,
            quality_score,
            punctuality_score,
            total_score,
            passed_first_time,
            passed_after_rework,
            failed_but_accepted,
            failed_returned,
            within_due_date,
            five_days_late,
            within_14_days,
            over_14_days_late,
            notes,
            created_at,
            updated_at,
            warehouse_item:warehouse_items (
              id,
              item_code,
              name
            )
          )
        `)
        .eq("supplier_id", supplierId)
        .order("evaluation_period_start", { ascending: false });

      if (error) throw error;
      return data as SupplierEvaluation[];
    },
    enabled: !!supplierId,
  });
};