export interface BillOfMaterials {
  id: string;
  bom_number: string;
  product_name: string;
  warehouse_item_id?: string; // Link to warehouse item for the product
  finished_good_id?: string; // Link to finished goods product master
  style_no?: string;
  version: string;
  size?: string;
  description?: string;
  status: 'active' | 'inactive' | 'draft';
  po_id?: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BomItem {
  id: string;
  bom_id: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_of_measure: string;
  unit_cost?: number;
  total_cost?: number;
  supplier_part_number?: string;
  manufacturer_part_number?: string;
  po_item_id?: string;
  notes?: string;
  item_code?: string;
  colour?: string;
  consumption?: number;
  category?: string;
  warehouse_item_id?: string; // Link to warehouse item
  created_at: string;
  updated_at: string;
}

export interface CreateBomData {
  product_name: string;
  warehouse_item_id?: string; // Link to warehouse item for the product
  finished_good_id?: string; // Link to finished goods product master
  style_no?: string;
  version?: string;
  size?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'draft';
  po_id?: string;
  company_id?: string;
  items: CreateBomItemData[];
}

export interface CreateBomItemData {
  item_name: string;
  description?: string;
  quantity: number;
  unit_of_measure: string;
  unit_cost?: number;
  supplier_part_number?: string;
  manufacturer_part_number?: string;
  po_item_id?: string;
  notes?: string;
  item_code?: string;
  colour?: string;
  consumption?: number;
  category?: string;
  warehouse_item_id?: string; // Link to warehouse item
}

export interface UpdateBomData extends Partial<CreateBomData> {
  id: string;
}