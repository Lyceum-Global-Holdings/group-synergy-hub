export type WarehouseCategory = 'raw_materials' | 'finished_goods' | 'general' | 'wip' | 'returns' | 'quarantine';

export interface WarehouseLocation {
  id: string;
  name: string;
  type: 'warehouse' | 'sublocation' | 'department';
  parent_id: string | null;
  description: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  capacity?: number | null;
  current_usage?: number | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  physical_address?: string | null;
  location_code?: string | null;
  status?: 'active' | 'inactive' | 'maintenance' | 'closed';
  warehouse_category?: WarehouseCategory | null;
  is_standalone_warehouse?: boolean;
  company_assignment_mode?: 'explicit' | 'inherit_parent';
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
  brand: string | null;
  asset_id: string | null;
  asset_master_id: string | null;
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
  type: 'warehouse' | 'location' | 'sublocation' | 'department';
  parent_id?: string;
  description?: string;
  company_id?: string;
  location_code?: string;
  capacity?: number;
  contact_person?: string;
  contact_phone?: string;
  physical_address?: string;
  status?: 'active' | 'inactive' | 'maintenance' | 'closed';
  warehouse_category?: WarehouseCategory;
  is_standalone_warehouse?: boolean;
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
  brand?: string;
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