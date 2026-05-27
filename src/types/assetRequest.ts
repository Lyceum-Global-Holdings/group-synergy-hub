import { Database } from "@/integrations/supabase/types";

export type AssetRequestStatus = Database["public"]["Enums"]["asset_request_status"];
export type AssetRequestPriority = Database["public"]["Enums"]["asset_request_priority"];
export type AssetRequestItemStatus = Database["public"]["Enums"]["asset_request_item_status"];
export type AssetRequestItemType = Database["public"]["Enums"]["asset_request_item_type"];
export type WorkflowStage = Database["public"]["Enums"]["workflow_stage"];

export interface AssetRequest {
  id: string;
  request_number: string;
  requester_name: string;
  department: string | null;
  department_id: string | null;
  contact_number: string | null;
  purpose: string;
  justification: string | null;
  required_date: string;
  priority: AssetRequestPriority;
  status: AssetRequestStatus;
  
  // HOD Approval
  hod_approved_by: string | null;
  hod_approval_date: string | null;
  hod_comments: string | null;
  
  // Procurement Approval (optional, not used initially)
  procurement_approved_by: string | null;
  procurement_approval_date: string | null;
  procurement_comments: string | null;
  
  // Purchase
  purchased_by: string | null;
  purchased_date: string | null;
  purchase_notes: string | null;
  
  // Fulfillment
  fulfilled_by: string | null;
  fulfilled_date: string | null;
  rejection_reason: string | null;
  notes: string | null;

  // Pre-approval + MRN attachment
  approved_by_name: string | null;
  mrn_document_url: string | null;
  mrn_document_path: string | null;
  
  total_estimated_cost: number | null;
  request_date: string;
  company_id: string | null;
  created_by: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRequestItem {
  id: string;
  request_id: string;
  line_number: number | null;
  
  // Item details
  request_type: AssetRequestItemType;
  asset_master_id: string | null;
  item_name: string;
  item_description: string | null;
  brand: string | null;
  specifications: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  
  // Quantities
  quantity_requested: number;
  quantity_approved: number | null;
  quantity_fulfilled: number | null;
  
  // Pricing
  unit_price_estimate: number | null;
  total_price_estimate: number | null;
  
  // Status
  status: AssetRequestItemStatus;
  
  // Fulfillment tracking
  warehouse_asset_id: string | null;
  fulfillment_method: "purchase" | "from_stock" | "transfer" | null;
  
  notes: string | null;
  justification: string | null;
  preferred_vendor: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface AssetRequestWithItems extends AssetRequest {
  asset_request_items: AssetRequestItem[];
}

export interface WorkflowHistory {
  id: string;
  request_id: string;
  workflow_stage: WorkflowStage;
  performed_by: string | null;
  performed_at: string;
  comments: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}
