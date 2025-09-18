export type PrStatus = 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
export type PrPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface PurchaseRequisition {
  id: string;
  pr_number: string;
  title: string;
  description?: string;
  requested_by: string;
  department?: string;
  status: PrStatus;
  priority: PrPriority;
  requested_date: string;
  required_date: string;
  justification?: string;
  total_estimated_amount: number;
  approved_by?: string;
  approved_date?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  items?: PrItem[];
  requested_by_profile?: {
    full_name?: string;
    email?: string;
  };
  approved_by_profile?: {
    full_name?: string;
    email?: string;
  };
}

export interface PrItem {
  id?: string;
  pr_id: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_of_measure: string;
  estimated_unit_price: number;
  estimated_total_price: number;
  specifications?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PrApproval {
  id: string;
  pr_id: string;
  approver_id: string;
  action: PrStatus;
  comments?: string;
  created_at: string;
  approver_profile?: {
    full_name?: string;
    email?: string;
  };
}

export interface CreatePrData {
  title: string;
  description?: string;
  department?: string;
  priority: PrPriority;
  required_date: string;
  justification?: string;
  items: Omit<PrItem, 'id' | 'pr_id' | 'created_at' | 'updated_at'>[];
}