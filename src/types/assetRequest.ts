export type AssetRequestStatus = 
  | 'draft' 
  | 'pending_hod_approval' 
  | 'pending_procurement_approval'
  | 'approved' 
  | 'rejected' 
  | 'fulfilled'
  | 'partially_fulfilled'
  | 'cancelled';

export type AssetRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

export type AssetRequestItemType = 'from_master' | 'new_item';

export type FulfillmentMethod = 'from_stock' | 'purchase' | 'transfer';

export type AssetRequestItemStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'partially_fulfilled';

export type ApprovalLevel = 'hod' | 'procurement' | 'management';

export type ApprovalAction = 'approved' | 'rejected' | 'requested_changes';

export interface AssetRequest {
  id: string;
  request_number: string;
  request_date: string;
  requested_by: string | null;
  requester_name: string;
  department: string | null;
  contact_number: string | null;
  purpose: string;
  justification: string | null;
  required_date: string;
  priority: AssetRequestPriority;
  status: AssetRequestStatus;
  hod_approved_by: string | null;
  hod_approval_date: string | null;
  hod_comments: string | null;
  procurement_approved_by: string | null;
  procurement_approval_date: string | null;
  procurement_comments: string | null;
  rejection_reason: string | null;
  fulfilled_date: string | null;
  fulfilled_by: string | null;
  total_estimated_cost: number | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRequestItem {
  id: string;
  request_id: string;
  line_number: number | null;
  request_type: AssetRequestItemType;
  asset_master_id: string | null;
  item_name: string;
  item_description: string | null;
  brand: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  quantity_requested: number;
  quantity_approved: number | null;
  quantity_fulfilled: number;
  unit_price_estimate: number | null;
  total_price_estimate: number | null;
  specifications: string | null;
  justification: string | null;
  preferred_vendor: string | null;
  status: AssetRequestItemStatus;
  fulfillment_method: FulfillmentMethod | null;
  warehouse_asset_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  asset_master?: any;
  asset_categories?: any;
}

export interface AssetRequestApproval {
  id: string;
  request_id: string;
  approver_id: string;
  approval_level: ApprovalLevel;
  action: ApprovalAction;
  comments: string | null;
  created_at: string;
}

export interface CreateAssetRequestData {
  request_date: string;
  requester_name: string;
  department?: string;
  contact_number?: string;
  purpose: string;
  justification?: string;
  required_date: string;
  priority: AssetRequestPriority;
  notes?: string;
  company_id?: string;
}

export interface CreateAssetRequestItemData {
  request_id: string;
  line_number?: number;
  request_type: AssetRequestItemType;
  asset_master_id?: string;
  item_name: string;
  item_description?: string;
  brand?: string;
  category_id?: string;
  subcategory_id?: string;
  quantity_requested: number;
  unit_price_estimate?: number;
  total_price_estimate?: number;
  specifications?: string;
  justification?: string;
  preferred_vendor?: string;
  notes?: string;
}

export interface ApproveAssetRequestData {
  request_id: string;
  approval_level: ApprovalLevel;
  action: ApprovalAction;
  comments?: string;
}
