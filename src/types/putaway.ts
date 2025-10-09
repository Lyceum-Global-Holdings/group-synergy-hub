export interface PutawayRecord {
  id: string;
  putaway_number: string;
  grn_id: string | null;
  grn_number: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  putaway_date: string;
  completed_date: string | null;
  assigned_to: string | null;
  completed_by: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PutawayItem {
  id: string;
  putaway_id: string;
  warehouse_item_id: string;
  item_code: string | null;
  item_name: string;
  quantity: number;
  unit_of_measure: string;
  from_location_id: string | null;
  to_bin_id: string | null;
  status: 'pending' | 'completed';
  putaway_sequence: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePutawayRecordData {
  grn_id?: string;
  grn_number?: string;
  putaway_date?: string;
  assigned_to?: string;
  notes?: string;
  company_id?: string;
}

export interface CreatePutawayItemData {
  putaway_id: string;
  warehouse_item_id: string;
  item_code?: string;
  item_name: string;
  quantity: number;
  unit_of_measure?: string;
  from_location_id?: string;
  to_bin_id?: string;
  putaway_sequence?: number;
  notes?: string;
}
