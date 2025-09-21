export interface BillOfMaterials {
  id: string;
  bom_number: string;
  po_id?: string;
  company_id?: string;
  product_name: string;
  description?: string;
  version: string;
  status: 'active' | 'inactive' | 'draft';
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: BomItem[];
  purchase_order?: {
    po_number: string;
    supplier?: {
      name: string;
    };
  };
}

export interface BomItem {
  id: string;
  bom_id: string;
  po_item_id?: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_of_measure: string;
  unit_cost?: number;
  total_cost?: number;
  supplier_part_number?: string;
  manufacturer_part_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBomData {
  po_id?: string;
  company_id?: string;
  product_name: string;
  description?: string;
  version?: string;
  status: 'active' | 'inactive' | 'draft';
  items: {
    po_item_id?: string;
    item_name: string;
    description?: string;
    quantity: number;
    unit_of_measure: string;
    unit_cost?: number;
    total_cost?: number;
    supplier_part_number?: string;
    manufacturer_part_number?: string;
    notes?: string;
  }[];
}

export interface UpdateBomData extends Partial<CreateBomData> {
  id: string;
}