export type CycleCountScheduleType = 'abc_analysis' | 'location_based' | 'item_based' | 'random';
export type CycleCountFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type CycleCountStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type CycleCountItemStatus = 'pending' | 'counted' | 'variance_review' | 'approved' | 'adjusted';
export type VarianceReason = 'damaged' | 'stolen' | 'misplaced' | 'system_error' | 'other';

export interface CycleCountSchedule {
  id: string;
  schedule_name: string;
  schedule_type: CycleCountScheduleType;
  frequency: CycleCountFrequency;
  priority: string;
  location_ids: string[] | null;
  category_ids: string[] | null;
  item_ids: string[] | null;
  abc_classification: string | null;
  next_count_date: string | null;
  last_count_date: string | null;
  count_per_cycle: number;
  status: string;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CycleCount {
  id: string;
  count_number: string;
  schedule_id: string | null;
  count_date: string;
  count_type: string;
  status: CycleCountStatus;
  location_id: string | null;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_items_to_count: number;
  items_counted: number;
  items_with_variance: number;
  total_variance_value: number;
  approved_by: string | null;
  approved_date: string | null;
  approval_notes: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CycleCountItem {
  id: string;
  cycle_count_id: string;
  warehouse_item_id: string;
  bin_id: string | null;
  system_quantity: number;
  system_value: number | null;
  physical_quantity: number | null;
  physical_value: number | null;
  variance_quantity: number | null;
  variance_value: number | null;
  variance_percentage: number | null;
  counted_by: string | null;
  counted_at: string | null;
  recount_required: boolean;
  recount_count: number;
  variance_reason: VarianceReason | null;
  investigation_notes: string | null;
  status: CycleCountItemStatus;
  created_at: string;
  updated_at: string;
}

export interface CycleCountAdjustment {
  id: string;
  cycle_count_id: string;
  cycle_count_item_id: string;
  adjustment_type: 'increase' | 'decrease';
  adjustment_quantity: number;
  adjustment_value: number | null;
  reason: string;
  stock_transaction_id: string | null;
  approved_by: string | null;
  approved_date: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateCycleCountScheduleData {
  schedule_name: string;
  schedule_type: CycleCountScheduleType;
  frequency: CycleCountFrequency;
  priority?: string;
  location_ids?: string[];
  category_ids?: string[];
  item_ids?: string[];
  abc_classification?: string;
  next_count_date?: string;
  count_per_cycle?: number;
  company_id?: string;
}

export interface CreateCycleCountData {
  schedule_id?: string;
  count_date: string;
  count_type: string;
  location_id?: string;
  assigned_to?: string;
  notes?: string;
  company_id?: string;
}

export interface CreateCycleCountItemData {
  cycle_count_id: string;
  warehouse_item_id: string;
  bin_id?: string;
  system_quantity: number;
  system_value?: number;
}

export interface UpdateCycleCountItemData {
  physical_quantity: number;
  counted_by?: string;
  variance_reason?: VarianceReason;
  investigation_notes?: string;
}
