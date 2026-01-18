export type BatchStatus = 'active' | 'depleted' | 'expired' | 'quarantine';

export interface ItemBatch {
  id: string;
  warehouse_item_id: string;
  batch_number: string;
  manufacturing_date?: string;
  expiry_date?: string;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  grn_item_id?: string;
  status: BatchStatus;
  company_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  warehouse_item?: {
    name: string;
    item_code?: string;
    is_batch_tracked: boolean;
  };
}

export interface BatchStockAllocation {
  id: string;
  batch_id: string;
  bin_id: string;
  allocated_quantity: number;
  company_id?: string;
  created_at: string;
  updated_at: string;
  batch?: ItemBatch;
  bin?: {
    bin_code: string;
    bin_name: string;
  };
}

export interface BatchIssueDetail {
  id: string;
  issue_item_id: string;
  batch_id: string;
  quantity_from_batch: number;
  created_at: string;
  batch?: ItemBatch;
}

export interface BatchAllocation {
  batch_id: string;
  batch_number: string;
  quantity: number;
  expiry_date?: string;
  manufacturing_date?: string;
}

export interface CreateBatchData {
  warehouse_item_id: string;
  batch_number: string;
  manufacturing_date?: string;
  expiry_date?: string;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost?: number;
  grn_item_id?: string;
  company_id?: string;
  notes?: string;
}
