export type MaterialIssueStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'issued' | 'partially_received' | 'completed' | 'cancelled';
export type MaterialReturnStatus = 'draft' | 'approved' | 'returned' | 'cancelled';
export type MaterialReturnType = 'internal' | 'supplier';
export type MaterialReferenceType = 'material_issue' | 'purchase_order' | 'other';
export type MaterialCondition = 'good' | 'damaged' | 'expired';

export type MaterialRequestStatus = 
  | 'draft' 
  | 'pending_hod_approval' 
  | 'pending_management_approval' 
  | 'approved' 
  | 'rejected' 
  | 'issued' 
  | 'partially_received'
  | 'completed'
  | 'cancelled';

export type MaterialRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

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
  cpo_id: string | null;
  cpo_number: string | null;
  company_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_date: string | null;
  created_at: string;
  updated_at: string;
  requested_by: string | null;
  contact_number: string | null;
  epf_number: string | null;
  items_required_date: string | null;
  job_number: string | null;
  pr_number: string | null;
  po_number: string | null;
  dispatch_note: string | null;
  received_by: string | null;
  received_by_name: string | null;
  received_date: string | null;
  issued_by: string | null;
  issued_by_name: string | null;
  order_completed: boolean | null;
  hod_approved_by: string | null;
  hod_approval_date: string | null;
  management_approved_by: string | null;
  management_approval_date: string | null;
  mr_received_by: string | null;
  mr_received_date: string | null;
  form_reference: string | null;
  location_id: string | null;
  srn_number: string | null;
  srn_document_url?: string | null;
}

export interface CreateMaterialIssueData {
  issue_date: string;
  issued_to: string;
  department?: string;
  purpose?: string;
  notes?: string;
  cpo_id?: string;
  cpo_number?: string;
  company_id?: string;
  requested_by?: string;
  contact_number?: string;
  epf_number?: string;
  items_required_date?: string;
  job_number?: string;
  pr_number?: string;
  po_number?: string;
  location_id?: string;
  srn_number?: string;
  srn_document_url?: string | null;
}

export interface MaterialIssueItem {
  id: string;
  min_id: string;
  item_id: string;
  quantity_issued: number;
  unit_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  reservation_id: string | null;
  from_reservation: boolean;
  created_at: string;
  updated_at: string;
  line_number: number | null;
  item_code: string | null;
  description: string | null;
  purpose: string | null;
  unit_of_measure: string | null;
  quantity_required: number | null;
  quantity_received: number | null;
  recipient_signature: string | null;
  issued_at: string | null;
  received_at: string | null;
  variance_quantity?: number | null;
  variance_reason?: 'shortage' | 'damaged' | 'expired' | 'other' | null;
  variance_notes?: string | null;
  condition?: 'good' | 'damaged' | 'expired' | null;
  warehouse_item_id?: string;
  srn_number?: string | null;
}

export interface CreateMaterialIssueItemData {
  min_id: string;
  item_id: string;
  quantity_issued: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  reservation_id?: string;
  from_reservation?: boolean;
  secondary_quantity_issued?: number | null;
  secondary_uom?: string | null;
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
  srn_number: string | null;
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
  srn_number?: string;
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
  secondary_quantity_returned?: number | null;
  secondary_uom?: string | null;
}

export interface CreateMaterialReturnItemData {
  mrn_id: string;
  item_id: string;
  quantity_returned: number;
  unit_cost?: number;
  total_cost?: number;
  condition?: MaterialCondition;
  notes?: string;
  secondary_quantity_returned?: number | null;
  secondary_uom?: string | null;
}

export interface MaterialRequest {
  id: string;
  request_number: string;
  request_date: string;
  requested_by: string;
  department: string | null;
  location_id: string | null;
  contact_number: string | null;
  epf_number: string | null;
  job_number: string | null;
  cpo_id: string | null;
  cpo_number: string | null;
  items_required_date: string;
  purpose: string;
  priority: MaterialRequestPriority;
  status: MaterialRequestStatus;
  hod_approved_by: string | null;
  hod_approval_date: string | null;
  hod_comments: string | null;
  management_approved_by: string | null;
  management_approval_date: string | null;
  management_comments: string | null;
  rejection_reason: string | null;
  min_id: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  srn_number: string | null;
}

export interface CreateMaterialRequestData {
  request_date: string;
  requested_by: string;
  department?: string;
  location_id?: string;
  contact_number?: string;
  epf_number?: string;
  job_number?: string;
  cpo_id?: string;
  cpo_number?: string;
  items_required_date: string;
  purpose: string;
  priority?: MaterialRequestPriority;
  notes?: string;
  company_id?: string;
  srn_number?: string;
}

export interface MaterialRequestItem {
  id: string;
  request_id: string;
  item_id: string;
  line_number: number | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
  unit_of_measure: string;
  quantity_requested: number;
  quantity_approved: number | null;
  quantity_issued: number;
  quantity_received: number;
  purpose: string | null;
  notes: string | null;
  issued_at: string | null;
  received_at: string | null;
  received_by: string | null;
  adjustment_reason: string | null;
  created_at: string;
  updated_at: string;
  srn_number?: string | null;
}

export interface CreateMaterialRequestItemData {
  request_id: string;
  item_id: string;
  line_number?: number;
  item_code?: string;
  description?: string;
  unit_of_measure?: string;
  quantity_requested: number;
  quantity_approved?: number;
  purpose?: string;
  notes?: string;
}