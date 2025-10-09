export type TransferStatus = 'draft' | 'pending_approval' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
export type TransferType = 'location' | 'department' | 'emergency';
export type TransferPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TransferItemStatus = 'pending' | 'in_transit' | 'completed';

export interface StockTransferRequest {
  id: string;
  transfer_number: string;
  transfer_date: string;
  from_location_id: string | null;
  from_sublocation_id: string | null;
  from_department_id: string | null;
  to_location_id: string | null;
  to_sublocation_id: string | null;
  to_department_id: string | null;
  status: TransferStatus;
  transfer_type: TransferType;
  priority: TransferPriority;
  requested_by: string | null;
  approved_by: string | null;
  completed_by: string | null;
  requested_date: string | null;
  approved_date: string | null;
  completed_date: string | null;
  expected_completion_date: string | null;
  reason: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  warehouse_item_id: string;
  item_code: string | null;
  item_name: string;
  quantity_requested: number;
  quantity_transferred: number;
  unit_of_measure: string;
  from_bin_id: string | null;
  to_bin_id: string | null;
  status: TransferItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStockTransferData {
  transfer_date: string;
  from_location_id?: string;
  from_sublocation_id?: string;
  from_department_id?: string;
  to_location_id?: string;
  to_sublocation_id?: string;
  to_department_id?: string;
  transfer_type: TransferType;
  priority: TransferPriority;
  expected_completion_date?: string;
  reason?: string;
  notes?: string;
  company_id?: string;
}

export interface CreateStockTransferItemData {
  transfer_id: string;
  warehouse_item_id: string;
  item_code?: string;
  item_name: string;
  quantity_requested: number;
  unit_of_measure?: string;
  from_bin_id?: string;
  to_bin_id?: string;
  notes?: string;
}
