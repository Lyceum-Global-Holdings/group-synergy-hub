export interface SalesOrder {
  id: string;
  order_number: string;
  cpo_id: string;
  customer_id: string;
  order_date: string;
  required_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'confirmed' | 'picking' | 'picked' | 'packing' | 'packed' | 'dispatched' | 'delivered' | 'cancelled';
  delivery_address: string | null;
  special_instructions: string | null;
  total_items: number;
  picked_items: number;
  packed_items: number;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSalesOrderData {
  cpo_id: string;
  customer_id: string;
  required_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  delivery_address?: string;
  special_instructions?: string;
  company_id?: string;
}

export interface PickList {
  id: string;
  pick_list_number: string;
  sales_order_id: string;
  picker_id: string | null;
  pick_zone: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  total_items: number;
  picked_items: number;
  started_at: string | null;
  completed_at: string | null;
  estimated_pick_time: number | null;
  actual_pick_time: number | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePickListData {
  sales_order_id: string;
  picker_id?: string;
  pick_zone?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimated_pick_time?: number;
  notes?: string;
  company_id?: string;
}

export interface PickListItem {
  id: string;
  pick_list_id: string;
  finished_good_id: string;
  location_id: string | null;
  bin_id: string | null;
  quantity_to_pick: number;
  quantity_picked: number;
  pick_sequence: number;
  status: 'pending' | 'picked' | 'short_pick' | 'not_found';
  picked_at: string | null;
  picked_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePickListItemData {
  pick_list_id: string;
  finished_good_id: string;
  location_id?: string;
  bin_id?: string;
  quantity_to_pick: number;
  pick_sequence?: number;
}

export interface PackingList {
  id: string;
  packing_list_number: string;
  sales_order_id: string;
  pick_list_id: string;
  packer_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'quality_check';
  package_type: string | null;
  package_weight: number | null;
  package_dimensions: string | null;
  quality_checked_by: string | null;
  quality_checked_at: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchRecord {
  id: string;
  dispatch_number: string;
  sales_order_id: string;
  packing_list_id: string;
  courier_name: string | null;
  tracking_number: string | null;
  dispatch_date: string;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  delivery_address: string;
  delivery_contact: string | null;
  delivery_phone: string | null;
  status: 'ready_to_dispatch' | 'dispatched' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed_delivery' | 'returned';
  proof_of_delivery_url: string | null;
  delivery_notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types with related data for UI display
export interface SalesOrderWithDetails extends SalesOrder {
  customer?: {
    id: string;
    customer_name: string;
    customer_code: string;
  };
  cpo?: {
    id: string;
    cpo_number: string;
    total_amount: number;
  };
  pick_lists?: PickList[];
}

export interface PickListWithDetails extends PickList {
  sales_order?: SalesOrder;
  picker?: {
    id: string;
    full_name: string;
  };
  items?: PickListItemWithDetails[];
}

export interface PickListItemWithDetails extends PickListItem {
  finished_good?: {
    id: string;
    product_name: string;
    product_code: string;
    current_stock: number;
  };
  location?: {
    id: string;
    name: string;
  };
  bin?: {
    id: string;
    bin_number: string;
  };
}