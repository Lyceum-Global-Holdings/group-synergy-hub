export type ApprovalType = 
  | 'supplier_registration' 
  | 'purchase_order' 
  | 'purchase_requisition' 
  | 'customer_po' 
  | 'production_receipt' 
  | 'bom' 
  | 'asset_request' 
  | 'material_request' 
  | 'stock_transfer' 
  | 'material_issue' 
  | 'grn';

export type ApprovalPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ApprovalStatus = 'pending' | 'in_progress' | 'requires_info';

export interface UnifiedApproval {
  // Core identification
  id: string;
  type: ApprovalType;
  
  // Display information
  title: string;
  description: string;
  priority: ApprovalPriority;
  
  // Approval metadata
  status: ApprovalStatus;
  assigned_to: string;
  assigned_to_name: string;
  stage: string | null;
  stage_order: number | null;
  
  // Timing
  created_at: string;
  age_days: number;
  sla_deadline: string | null;
  is_overdue: boolean;
  
  // Financial (if applicable)
  amount: number | null;
  currency: string | null;
  
  // Related entity
  entity_id: string;
  entity_data: any;
  
  // Actions
  can_approve: boolean;
  can_reject: boolean;
  can_request_info: boolean;
  requires_comments: boolean;
  
  // Navigation
  view_url: string;
}

export interface ApprovalFilters {
  type?: ApprovalType;
  priority?: ApprovalPriority;
  status?: ApprovalStatus;
  overdue?: boolean;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export interface ApprovalStats {
  total: number;
  urgent: number;
  overdue: number;
  today: number;
  byType: Record<string, number>;
  totalAmount: number;
}
