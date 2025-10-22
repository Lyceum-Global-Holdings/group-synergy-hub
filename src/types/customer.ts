export interface Customer {
  id: string;
  customer_code: string;
  customer_name: string;
  customer_type: 'person' | 'company';
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  company_id?: string;
  status: 'active' | 'inactive';
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Company-specific fields
  company_registration_document_url?: string;
  registration_number?: string;
  tax_id?: string;
  // Person-specific fields
  first_name?: string;
  last_name?: string;
  id_passport_number?: string;
}

export interface CreateCustomerData {
  customer_name: string;
  customer_type: 'person' | 'company';
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  company_id?: string;
  status?: 'active' | 'inactive';
  // Company-specific fields
  company_registration_document_url?: string;
  registration_number?: string;
  tax_id?: string;
  // Person-specific fields
  first_name?: string;
  last_name?: string;
  id_passport_number?: string;
}

export interface CustomerPurchaseOrder {
  id: string;
  cpo_number: string;
  customer_id: string;
  company_id?: string;
  po_date: string;
  delivery_date?: string;
  total_amount: number;
  status: 'draft' | 'pending_approval' | 'confirmed' | 'in_production' | 'delivered' | 'completed' | 'cancelled' | 'rejected';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Approval fields
  pending_approval?: boolean;
  approved_by?: string;
  approved_date?: string;
  approval_comments?: string;
  // Joined data
  customer?: Customer;
  items?: CustomerPoItem[];
  approvals?: CustomerPoApproval[];
  workflow_tracking?: CustomerPoWorkflowTracking[];
}

export interface CustomerPoApproval {
  id: string;
  cpo_id: string;
  approver_id: string;
  action: 'approved' | 'rejected' | 'pending_approval';
  comments?: string;
  created_at: string;
  approver_profile?: {
    full_name?: string;
    email?: string;
  };
}

export interface CustomerPoWorkflowTracking {
  id: string;
  cpo_id: string;
  material_demand_id?: string;
  pr_id?: string;
  po_id?: string;
  workflow_stage: 'cpo_created' | 'cpo_approved' | 'material_demand_planned' | 'pr_created' | 'pr_approved' | 'po_created' | 'po_approved' | 'completed';
  stage_completed_at: string;
  stage_completed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerPoItem {
  id: string;
  cpo_id: string;
  finished_good_id?: string;
  product_master_id?: string;
  item_name: string;
  description?: string;
  quantity_ordered: number;
  unit_price: number;
  total_price: number;
  delivery_date?: string;
  color?: string;
  size?: string;
  style_no?: string; // NEW: Style number for matching
  unit_of_measure?: string; // NEW: Unit of measure
  status: 'pending' | 'confirmed' | 'in_production' | 'delivered';
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerPoData {
  customer_id: string;
  company_id?: string;
  cpo_number?: string;
  po_date?: string;
  delivery_date?: string;
  notes?: string;
  items: {
    finished_good_id?: string | null;
    product_master_id?: string | null;
    item_name: string;
    description?: string;
    quantity_ordered: number;
    unit_price: number;
    total_price: number;
    delivery_date?: string;
    color?: string;
    size?: string;
  }[];
}