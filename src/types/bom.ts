export interface BillOfMaterials {
  id: string;
  bom_number: string;
  product_name: string;
  product_master_id?: string;
  warehouse_item_id?: string;
  style_no?: string;
  version: string;
  size?: string;
  color?: string;
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
  warehouse_item_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBomData {
  product_name: string;
  product_master_id?: string;
  warehouse_item_id?: string;
  style_no?: string;
  version?: string;
  size?: string;
  color?: string;
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
  warehouse_item_id?: string;
}

export interface UpdateBomData extends Partial<CreateBomData> {
  id: string;
}

// BOM Version Types
export interface BomVersion {
  id: string;
  bom_id: string;
  version_number: string;
  version_notes?: string;
  changes_summary?: any[];
  previous_version_id?: string;
  created_by?: string;
  created_at: string;
  version_data: any;
}

// BOM Template Types
export interface BomTemplate {
  id: string;
  template_name: string;
  category?: string;
  description?: string;
  is_public: boolean;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  template_data: any;
  usage_count: number;
}

// BOM Item Substitution Types
export interface BomItemSubstitution {
  id: string;
  bom_item_id: string;
  substitute_item_id: string;
  priority: number;
  notes?: string;
  cost_difference?: number;
  availability_status: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// BOM Approval Types
export interface BomApproval {
  id: string;
  bom_id: string;
  approver_id: string;
  approval_level: number;
  approval_status: string;
  comments?: string;
  approved_at?: string;
  created_at: string;
}

// BOM Size Multiplier Types
export interface BomSizeMultiplier {
  id: string;
  bom_id: string;
  size: string;
  multiplier: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSizeMultiplierData {
  bom_id: string;
  size: string;
  multiplier: number;
  notes?: string;
}

// Default size multipliers based on industry standards
export const DEFAULT_SIZE_MULTIPLIERS: Record<string, number> = {
  'XS': 0.85,
  'S': 0.92,
  'M': 1.0,
  'L': 1.12,
  'XL': 1.25,
  '2XL': 1.40,
  'XXL': 1.40,
  '3XL': 1.55,
  'XXXL': 1.55,
  'KIDS': 0.60,
  'KIDM': 0.70,
  'KIDL': 0.80,
};
