export interface Customer {
  id: string;
  customer_code: string;
  customer_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  company_id?: string;
  status: 'active' | 'inactive';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerData {
  customer_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  company_id?: string;
  status?: 'active' | 'inactive';
}

export interface CustomerPurchaseOrder {
  id: string;
  cpo_number: string;
  customer_id: string;
  company_id?: string;
  po_date: string;
  delivery_date?: string;
  total_amount: number;
  status: 'draft' | 'confirmed' | 'in_production' | 'delivered' | 'completed' | 'cancelled';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: Customer;
  items?: CustomerPoItem[];
}

export interface CustomerPoItem {
  id: string;
  cpo_id: string;
  finished_good_id?: string;
  item_name: string;
  description?: string;
  quantity_ordered: number;
  unit_price: number;
  total_price: number;
  delivery_date?: string;
  status: 'pending' | 'confirmed' | 'in_production' | 'delivered';
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerPoData {
  customer_id: string;
  company_id?: string;
  po_date?: string;
  delivery_date?: string;
  notes?: string;
  items: {
    finished_good_id?: string | null;
    item_name: string;
    description?: string;
    quantity_ordered: number;
    unit_price: number;
    total_price: number;
    delivery_date?: string;
  }[];
}