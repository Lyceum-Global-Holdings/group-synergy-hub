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
}

export interface CreatePurchaseHistoryData {
  asset_master_id: string;
  purchase_price: number;
  purchase_date: string;
  vendor?: string;
  quantity_purchased?: number;
  notes?: string;
}
