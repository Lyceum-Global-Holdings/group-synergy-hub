export type PoStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'acknowledged' | 'partially_received' | 'completed' | 'cancelled';
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
  items?: PoItem[];
  receipts?: PoReceipt[];
  approvals?: PoApproval[];
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