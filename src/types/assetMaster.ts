export interface AssetMaster {
  id: string;
  asset_name: string;
  brand: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  purchase_price: number | null;
  current_value: number | null;
  image_url: string | null;
  description: string | null;
  status: 'active' | 'inactive';
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  depreciation_method?: string | null;
  depreciation_rate?: number | null;
  useful_life_years?: number | null;
  salvage_value?: number | null;
  purchase_date?: string | null;
  accumulated_depreciation?: number | null;
}

export interface AssetMasterPurchaseHistory {
  id: string;
  asset_master_id: string;
  purchase_price: number;
  purchase_date: string;
  vendor: string | null;
  quantity_purchased: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateAssetMasterData {
  asset_name: string;
  brand?: string;
  category_id?: string;
  subcategory_id?: string;
  purchase_price?: number;
  current_value?: number;
  image_url?: string;
  description?: string;
  company_id?: string;
  depreciation_method?: string;
  depreciation_rate?: number;
  useful_life_years?: number;
  salvage_value?: number;
  purchase_date?: string;
}

export interface CreatePurchaseHistoryData {
  asset_master_id: string;
  purchase_price: number;
  purchase_date: string;
  vendor?: string;
  quantity_purchased?: number;
  notes?: string;
}
