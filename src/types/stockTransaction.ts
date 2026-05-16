export type StockTransactionType = 
  | 'opening_stock'
  | 'goods_receipt' 
  | 'material_issue'
  | 'material_return'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'project_issue'
  | 'project_return';

export type StockReferenceType = 
  | 'manual'
  | 'grn'
  | 'mrn' 
  | 'adjustment'
  | 'transfer'
  | 'project';

export interface StockTransaction {
  id: string;
  item_id: string;
  transaction_type: StockTransactionType;
  reference_type: StockReferenceType;
  reference_id: string | null;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number | null;
  total_value: number | null;
  notes: string | null;
  company_id: string | null;
  location_id?: string | null;
  bin_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  issued_to_location_id: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface CreateStockTransactionData {
  item_id: string;
  transaction_type: StockTransactionType;
  reference_type: StockReferenceType;
  reference_id?: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost?: number;
  total_value?: number;
  notes?: string;
  company_id?: string;
  location_id?: string;
  bin_id?: string;
  issued_to_location_id?: string;
  secondary_quantity_change?: number;
  secondary_uom?: string;
}

export interface MaterialReturnNote {
  id: string;
  mrn_number: string;
  return_date: string;
  returned_by: string;
  supplier_id: string;
  po_id: string | null;
  grn_id: string | null;
  status: 'draft' | 'approved' | 'completed';
  reason: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialReturnData {
  return_date: string;
  supplier_id: string;
  po_id?: string;
  grn_id?: string;
  reason: string;
  notes?: string;
}