export interface ProductColor {
  id: string;
  color_name: string;
  color_code?: string;
  hex_value?: string;
  is_active: boolean;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductMaster {
  id: string;
  product_code: string;
  product_name: string;
  style_no?: string;
  description?: string;
  category_id?: string;
  subcategory_id?: string;
  available_colors: string[];
  available_sizes: string[];
  unit_of_measure: string;
  base_price?: number;
  image_url?: string;
  status: 'active' | 'inactive' | 'discontinued';
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductMasterData {
  product_code: string;
  product_name: string;
  style_no?: string;
  description?: string;
  category_id?: string;
  subcategory_id?: string;
  available_colors: string[];
  available_sizes: string[];
  unit_of_measure?: string;
  base_price?: number;
  image_url?: string;
  status?: 'active' | 'inactive' | 'discontinued';
}

export interface UpdateProductMasterData extends Partial<CreateProductMasterData> {
  id: string;
}
