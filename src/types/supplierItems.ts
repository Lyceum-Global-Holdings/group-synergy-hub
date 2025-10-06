export interface SupplierItem {
  id: string;
  supplier_id: string;
  warehouse_item_id: string;
  supplier_item_code?: string;
  supplier_unit_price?: number;
  minimum_order_quantity: number;
  lead_time_days: number;
  is_preferred_supplier: boolean;
  notes?: string;
  status: 'active' | 'inactive' | 'discontinued';
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierItemWithDetails extends SupplierItem {
  warehouse_item?: {
    id: string;
    item_code: string;
    name: string;
    category_id?: string;
    unit_id?: string;
    current_stock: number;
  };
}

export interface CreateSupplierItemData {
  supplier_id: string;
  warehouse_item_id: string;
  supplier_item_code?: string;
  supplier_unit_price?: number;
  minimum_order_quantity?: number;
  lead_time_days?: number;
  is_preferred_supplier?: boolean;
  notes?: string;
  status?: 'active' | 'inactive' | 'discontinued';
}

export interface UpdateSupplierItemData extends Partial<CreateSupplierItemData> {
  id: string;
}
