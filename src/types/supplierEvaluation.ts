export interface SupplierEvaluation {
  id: string;
  evaluation_number: string;
  supplier_id: string;
  product_name: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  total_deliveries: number;
  total_points_achieved: number;
  total_possible_points: number;
  performance_rate: number;
  status: string;
  evaluated_by?: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  warehouse_item_id?: string;
  supplier_item_id?: string;
  // Related data
  supplier?: {
    id: string;
    name: string;
    supplier_code: string;
  };
  warehouse_item?: {
    id: string;
    item_code: string;
    name: string;
  };
  entries?: SupplierEvaluationEntry[];
}

export interface SupplierEvaluationEntry {
  id: string;
  evaluation_id: string;
  receipt_date: string;
  po_delivery_date: string;
  po_number?: string;
  warehouse_item_id?: string;
  // Product Quality flags
  passed_first_time: boolean;
  passed_after_rework: boolean;
  failed_but_accepted: boolean;
  failed_returned: boolean;
  // Punctuality flags
  within_due_date: boolean;
  five_days_late: boolean;
  within_14_days: boolean;
  over_14_days_late: boolean;
  // Calculated scores
  quality_score: number;
  punctuality_score: number;
  total_score: number;
  notes?: string;
  /** "grn" when scored from an approved goods receipt, "manual" when typed in. */
  source?: "manual" | "grn";
  grn_id?: string | null;
  created_at: string;
  updated_at: string;
  // Related data
  warehouse_item?: {
    id: string;
    item_code: string;
    name: string;
  };
}

export interface CreateSupplierEvaluationData {
  supplier_id: string;
  product_name: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  warehouse_item_id?: string;
  supplier_item_id?: string;
  company_id?: string;
}

export interface CreateSupplierEvaluationEntryData {
  evaluation_id: string;
  receipt_date: string;
  po_delivery_date: string;
  po_number?: string;
  warehouse_item_id?: string;
  // Only one quality option should be true
  passed_first_time?: boolean;
  passed_after_rework?: boolean;
  failed_but_accepted?: boolean;
  failed_returned?: boolean;
  // Only one punctuality option should be true
  within_due_date?: boolean;
  five_days_late?: boolean;
  within_14_days?: boolean;
  over_14_days_late?: boolean;
  notes?: string;
}

export const EVALUATION_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const;

export const QUALITY_OPTIONS = [
  { key: 'passed_first_time', label: 'Passed First Time', score: 50 },
  { key: 'passed_after_rework', label: 'Passed After Re-work', score: 30 },
  { key: 'failed_but_accepted', label: 'Failed but Accepted', score: 20 },
  { key: 'failed_returned', label: 'Failed & Returned', score: 0 },
] as const;

export const PUNCTUALITY_OPTIONS = [
  { key: 'within_due_date', label: 'Within Due Date', score: 50 },
  { key: 'five_days_late', label: '5 Days Late', score: 30 },
  { key: 'within_14_days', label: 'Within 14 Days', score: 20 },
  { key: 'over_14_days_late', label: 'Over 14 Days Late', score: 0 },
] as const;