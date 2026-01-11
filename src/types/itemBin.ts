export interface ItemCategory {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  description: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ItemUnit {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BinType {
  id: string;
  name: string;
  description: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WarehouseBin {
  id: string;
  bin_code: string;
  name: string;
  bin_type_id: string | null;
  location_id: string | null;
  capacity: number | null;
  current_quantity: number;
  status: 'active' | 'inactive' | 'maintenance' | 'full';
  description: string | null;
  notes: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WarehouseItem {
  id: string;
  item_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit_id: string | null;
  location_id: string | null;
  reorder_level: number | null;
  max_stock_level: number | null;
  min_stock_level: number | null;
  current_stock: number;
  unit_cost: number | null;
  selling_price: number | null;
  barcode: string | null;
  sku: string | null;
  brand: string | null;
  manufacturer: string | null;
  supplier_id: string | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
  bins?: Array<{
    id: string;
    bin_code: string;
    name: string;
    quantity: number;
  }> | null;
  status: 'active' | 'inactive' | 'discontinued';
  is_serialized: boolean;
  is_batch_tracked: boolean;
  notes: string | null;
  image_url: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateItemCategoryData {
  name: string;
  code?: string;
  parent_id?: string;
  description?: string;
  company_id?: string;
}

export interface CreateItemUnitData {
  name: string;
  abbreviation: string;
  description?: string;
  company_id?: string;
}

export interface CreateBinTypeData {
  name: string;
  description?: string;
  company_id?: string;
}

export interface CreateWarehouseBinData {
  bin_code: string;
  name: string;
  bin_type_id?: string;
  location_id?: string;
  capacity?: number;
  status: 'active' | 'inactive' | 'maintenance' | 'full';
  description?: string;
  notes?: string;
  company_id?: string;
}

export interface CreateWarehouseItemData {
  item_code: string;
  name: string;
  description?: string;
  category_id?: string;
  unit_id?: string;
  location_id?: string;
  reorder_level?: number;
  max_stock_level?: number;
  min_stock_level?: number;
  unit_cost?: number;
  selling_price?: number;
  barcode?: string;
  sku?: string;
  brand?: string;
  manufacturer?: string;
  supplier_id?: string;
  status: 'active' | 'inactive' | 'discontinued';
  is_serialized?: boolean;
  is_batch_tracked?: boolean;
  notes?: string;
  image_url?: string;
  company_id?: string;
}