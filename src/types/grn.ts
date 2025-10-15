export type GrnStatus = 'draft' | 'submitted' | 'approved' | 'completed' | 'cancelled';
export type QualityStatus = 'good' | 'damaged' | 'rejected';

export interface GoodsReceiptNote {
  id: string;
  grn_number: string;
  grn_date: string;
  po_id?: string;
  po_number?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_address?: string;
  invoice_number?: string;
  invoice_date?: string;
  status: GrnStatus;
  total_value: number;
  remarks?: string;
  company_id?: string;
  created_by?: string;
  received_by?: string;
  approved_by?: string;
  approved_date?: string;
  created_at: string;
  updated_at: string;
  grn_items?: GrnItem[];
  purchase_order?: {
    po_number: string;
    supplier: {
      name: string;
    };
  };
  created_by_profile?: {
    full_name: string;
  };
  received_by_profile?: {
    full_name: string;
  };
  approved_by_profile?: {
    full_name: string;
  };
}

export interface GrnItem {
  id: string;
  grn_id: string;
  po_item_id?: string;
  warehouse_item_id?: string;
  item_code?: string;
  item_name: string;
  description?: string;
  unit_of_measure: string;
  quantity_ordered?: number;
  quantity_received: number;
  unit_price: number;
  total_cost: number;
  quality_status: QualityStatus;
  remarks?: string;
  created_at: string;
  warehouse_item?: {
    item_name: string;
    item_code?: string;
    unit_of_measure: string;
  };
  po_item?: {
    item_name: string;
    quantity: number;
    quantity_received?: number;
  };
}

export interface CreateGrnData {
  grn_date: string;
  po_id?: string;
  po_number?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_address?: string;
  invoice_number?: string;
  invoice_date?: string;
  status: GrnStatus;
  remarks?: string;
  company_id?: string;
  items: CreateGrnItemData[];
}

export interface CreateGrnItemData {
  po_item_id?: string;
  warehouse_item_id?: string;
  item_code?: string;
  item_name: string;
  description?: string;
  unit_of_measure: string;
  quantity_ordered?: number;
  quantity_already_received?: number;
  quantity_pending_approval?: number;
  quantity_received: number;
  unit_price: number;
  total_cost: number;
  quality_status: QualityStatus;
  remarks?: string;
}

export interface GrnSummary {
  total_grns: number;
  pending_approval: number;
  approved_this_month: number;
  total_value: number;
}
