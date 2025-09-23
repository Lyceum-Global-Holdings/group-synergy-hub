export type GrnStatus = 'draft' | 'submitted' | 'approved' | 'completed';
export type QualityStatus = 'good' | 'damaged' | 'rejected';

export interface GoodsReceiptNote {
  id: string;
  grn_number: string;
  grn_date: string;
  invoice_number?: string;
  invoice_date?: string;
  po_id?: string;
  po_number?: string;
  pr_number?: string;
  mr_number?: string;
  supplier_id?: string;
  supplier_name: string;
  supplier_address?: string;
  branch?: string;
  status: GrnStatus;
  total_value: number;
  remarks?: string;
  received_by?: string;
  approved_by?: string;
  approved_date?: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface GrnItem {
  id: string;
  grn_id: string;
  item_code?: string;
  item_name: string;
  description?: string;
  warehouse_item_id?: string;
  po_item_id?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_of_measure: string;
  unit_price?: number;
  total_cost?: number;
  quality_status: QualityStatus;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGrnData {
  grn_date: string;
  invoice_number?: string;
  invoice_date?: string;
  po_id?: string;
  po_number?: string;
  pr_number?: string;
  mr_number?: string;
  supplier_id?: string;
  supplier_name: string;
  supplier_address?: string;
  branch?: string;
  remarks?: string;
  company_id?: string;
  items: CreateGrnItemData[];
}

export interface CreateGrnItemData {
  item_code?: string;
  item_name: string;
  description?: string;
  warehouse_item_id?: string;
  po_item_id?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_of_measure: string;
  unit_price?: number;
  total_cost?: number;
  quality_status: QualityStatus;
  remarks?: string;
}

export interface GrnWithItems extends GoodsReceiptNote {
  items: GrnItem[];
}

export interface GrnSummary {
  total_grns: number;
  draft_grns: number;
  approved_grns: number;
  total_value: number;
}