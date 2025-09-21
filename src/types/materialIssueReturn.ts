export type MaterialIssueStatus = 'draft' | 'approved' | 'issued' | 'cancelled';
export type MaterialReturnStatus = 'draft' | 'approved' | 'returned' | 'cancelled';
export type MaterialReturnType = 'internal' | 'supplier';
export type MaterialReferenceType = 'material_issue' | 'purchase_order' | 'other';
export type MaterialCondition = 'good' | 'damaged' | 'expired';

export interface MaterialIssueNote {
  id: string;
  min_number: string;
  issue_date: string;
  issued_to: string;
  department: string | null;
  purpose: string | null;
  status: MaterialIssueStatus;
  total_value: number | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialIssueData {
  issue_date: string;
  issued_to: string;
  department?: string;
  purpose?: string;
  notes?: string;
  company_id?: string;
}

export interface MaterialIssueItem {
  id: string;
  min_id: string;
  item_id: string;
  quantity_issued: number;
  unit_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialIssueItemData {
  min_id: string;
  item_id: string;
  quantity_issued: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
}

export interface MaterialReturnNote {
  id: string;
  mrn_number: string;
  return_date: string;
  returned_by: string;
  return_type: MaterialReturnType;
  reason: string;
  reference_type: MaterialReferenceType | null;
  reference_id: string | null;
  status: MaterialReturnStatus;
  total_value: number | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialReturnData {
  return_date: string;
  returned_by: string;
  return_type: MaterialReturnType;
  reason: string;
  reference_type?: MaterialReferenceType;
  reference_id?: string;
  notes?: string;
  company_id?: string;
}

export interface MaterialReturnItem {
  id: string;
  mrn_id: string;
  item_id: string;
  quantity_returned: number;
  unit_cost: number | null;
  total_cost: number | null;
  condition: MaterialCondition;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialReturnItemData {
  mrn_id: string;
  item_id: string;
  quantity_returned: number;
  unit_cost?: number;
  total_cost?: number;
  condition?: MaterialCondition;
  notes?: string;
}