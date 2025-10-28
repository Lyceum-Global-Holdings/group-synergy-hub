export type ReservationReferenceType = 
  | 'cpo' 
  | 'material_request' 
  | 'production_order' 
  | 'sales_order' 
  | 'manual';

export type ReservationStatus = 
  | 'active' 
  | 'partially_issued' 
  | 'issued' 
  | 'expired' 
  | 'cancelled';

export interface WarehouseBinAllocation {
  id: string;
  warehouse_item_id: string;
  bin_id: string;
  allocated_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseItemReservation {
  id: string;
  warehouse_item_id: string;
  bin_allocation_id: string | null;
  reserved_quantity: number;
  reference_type: ReservationReferenceType;
  reference_id: string | null;
  reference_number: string | null;
  reserved_date: string;
  required_date: string | null;
  expiry_date: string | null;
  status: ReservationStatus;
  quantity_issued: number;
  quantity_remaining: number;
  bom_id: string | null;
  bom_item_id: string | null;
  notes: string | null;
  company_id: string | null;
  reserved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReservationData {
  warehouse_item_id: string;
  bin_allocation_id?: string;
  reserved_quantity: number;
  reference_type: ReservationReferenceType;
  reference_id?: string;
  reference_number?: string;
  required_date?: string;
  expiry_date?: string;
  bom_id?: string;
  bom_item_id?: string;
  notes?: string;
  company_id?: string;
}

export interface CreateBinAllocationData {
  warehouse_item_id: string;
  bin_id: string;
  allocated_quantity: number;
  notes?: string;
  company_id?: string;
}

export interface BulkReservationRequest {
  cpo_id: string;
  cpo_number: string;
  items: {
    warehouse_item_id: string;
    item_code: string;
    item_name: string;
    required_quantity: number;
    bom_id?: string;
    bom_item_id?: string;
    bin_allocation_id?: string;
  }[];
  required_date: string;
  notes?: string;
}

export interface ReservationWithDetails extends WarehouseItemReservation {
  warehouse_item?: {
    item_code: string;
    name: string;
    current_stock: number;
    reserved_quantity: number;
  };
  bin_allocation?: {
    bin: {
      bin_code: string;
      name: string;
    };
    allocated_quantity: number;
    available_quantity: number;
  };
}

export interface BinAllocationWithDetails extends WarehouseBinAllocation {
  warehouse_item?: {
    item_code: string;
    name: string;
  };
  warehouse_bin?: {
    bin_code: string;
    name: string;
  };
}
