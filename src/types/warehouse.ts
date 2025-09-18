export interface WarehouseLocation {
  id: string;
  name: string;
  type: 'location' | 'sublocation' | 'department';
  parent_id: string | null;
  description: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AssetCategory {
  id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WarehouseAsset {
  id: string;
  name: string;
  category: string;
  category_id: string | null;
  subcategory_id: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  location_id: string | null;
  sublocation_id: string | null;
  department_id: string | null;
  condition: 'good' | 'fair' | 'poor' | 'needs_repair';
  status: 'active' | 'inactive' | 'maintenance' | 'disposed';
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  description: string | null;
  notes: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateWarehouseLocationData {
  name: string;
  type: 'location' | 'sublocation' | 'department';
  parent_id?: string;
  description?: string;
  company_id?: string;
}

export interface CreateAssetCategoryData {
  name: string;
  parent_id?: string;
  description?: string;
  company_id?: string;
}

export interface CreateWarehouseAssetData {
  name: string;
  category: string;
  category_id?: string;
  subcategory_id?: string;
  serial_number?: string;
  asset_tag?: string;
  location_id?: string;
  sublocation_id?: string;
  department_id?: string;
  condition: 'good' | 'fair' | 'poor' | 'needs_repair';
  status: 'active' | 'inactive' | 'maintenance' | 'disposed';
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  description?: string;
  notes?: string;
  company_id?: string;
}