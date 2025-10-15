export type PoStatus = 'draft' | 'pending_approval' | 'pending_dept_head_approval' | 'approved' | 'rejected' | 'sent' | 'acknowledged' | 'partially_received' | 'completed' | 'cancelled';
export type ReceiptStatus = 'partial' | 'complete';
export type QualityStatus = 'good' | 'damaged' | 'rejected';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  pr_id?: string;
  supplier_id: string;
  status: PoStatus;
  po_date: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_terms?: string;
  delivery_terms?: string;
  currency: string;
  buyer_id?: string;
  created_by: string;
  approved_by?: string;
  approved_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  approval_level: number;
  merchandiser_approved_by?: string;
  merchandiser_approved_date?: string;
  merchandiser_comments?: string;
  department_head_approved_by?: string;
  department_head_approved_date?: string;
  department_head_comments?: string;
  items?: PoItem[];
  receipts?: PoReceipt[];
  approvals?: PoApproval[];
  grns?: Array<{
    id: string;
    grn_number: string;
    grn_date: string;
    status: string;
    invoice_number?: string;
    total_value: number;
    received_by?: string;
    approved_by?: string;
    approved_date?: string;
    received_by_profile?: {
      full_name?: string;
      email?: string;
    };
    approved_by_profile?: {
      full_name?: string;
      email?: string;
    };
    grn_items?: Array<{
      id: string;
      item_name: string;
      quantity_received: number;
      unit_price: number;
      total_cost: number;
      quality_status: string;
    }>;
  }>;
  supplier?: {
    name: string;
    email?: string;
    phone?: string;
  };
  pr?: {
    pr_number: string;
    title: string;
  };
  created_by_profile?: {
    full_name?: string;
    email?: string;
  };
  buyer_profile?: {
    full_name?: string;
    email?: string;
  };
  approved_by_profile?: {
    full_name?: string;
    email?: string;
  };
  merchandiser_profile?: {
    full_name?: string;
    email?: string;
  };
  dept_head_profile?: {
    full_name?: string;
    email?: string;
  };
}

export interface PoItem {
  id?: string;
  po_id: string;
  pr_item_id?: string;
  warehouse_item_id?: string;
  item_name: string;
  item_code?: string;
  description?: string;
  specifications?: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_pending: number;
  unit_price: number;
  total_price: number;
  unit_of_measure: string;
  delivery_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PoReceipt {
  id: string;
  po_id: string;
  receipt_number: string;
  received_date: string;
  received_by: string;
  status: ReceiptStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: PoReceiptItem[];
  received_by_profile?: {
    full_name?: string;
    email?: string;
  };
}

export interface PoReceiptItem {
  id?: string;
  receipt_id: string;
  po_item_id: string;
  quantity_received: number;
  quality_status: QualityStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  po_item?: {
    item_name: string;
    unit_of_measure: string;
  };
}

export interface CreatePoData {
  pr_id?: string | null;
  supplier_id: string;
  expected_delivery_date?: string;
  payment_terms?: string;
  delivery_terms?: string;
  currency?: string;
  buyer_id?: string | null;
  notes?: string;
  items: {
    pr_item_id?: string | null;
    warehouse_item_id?: string | null;
    item_name: string;
    item_code?: string | null;
    description?: string;
    specifications?: string;
    quantity_ordered: number;
    unit_price: number;
    total_price: number;
    unit_of_measure: string;
    delivery_date?: string;
    notes?: string;
  }[];
}

export interface CreateReceiptData {
  po_id: string;
  receipt_number: string;
  received_date: string;
  notes?: string;
  items: {
    po_item_id: string;
    quantity_received: number;
    quality_status: QualityStatus;
    notes?: string;
  }[];
}

export interface PoApproval {
  id: string;
  po_id: string;
  approver_id: string;
  action: PoStatus;
  comments?: string;
  created_at: string;
  approval_level?: 'merchandiser' | 'department_head';
  approval_method?: 'manual' | 'email';
  approver_profile?: {
    full_name?: string;
    email?: string;
  };
}

export interface PoSummary {
  total_pos: number;
  draft_pos: number;
  pending_approval_pos: number;
  approved_pos: number;
  rejected_pos: number;
  sent_pos: number;
  completed_pos: number;
  pending_deliveries: number;
  total_value: number;
}

export type PoAmendmentType = 
  | 'price_change'
  | 'quantity_change'
  | 'delivery_date_change'
  | 'terms_change'
  | 'item_addition'
  | 'item_removal'
  | 'other';

export interface PoAmendment {
  id: string;
  amendment_number: string;
  po_id: string;
  amendment_type: PoAmendmentType;
  amendment_date: string;
  reason: string;
  notes?: string;
  previous_value?: any;
  new_value?: any;
  created_by?: string;
  created_at: string;
  approved_by?: string;
  approved_date?: string;
  approver_profile?: {
    full_name?: string;
    email?: string;
  };
}

export interface CreatePoAmendmentData {
  po_id: string;
  amendment_type: PoAmendmentType;
  reason: string;
  notes?: string;
  previous_value?: any;
  new_value?: any;
}