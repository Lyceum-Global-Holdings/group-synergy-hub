export type ValuationMethod = 
  | 'fifo' 
  | 'lifo' 
  | 'weighted_average' 
  | 'standard_cost' 
  | 'actual_cost';

export type ItemType = 'raw_material' | 'finished_good' | 'asset';

export type SnapshotType = 'daily' | 'monthly' | 'year_end' | 'manual';

export type ReportType = 'summary' | 'detailed' | 'aging' | 'comparison' | 'movement';

export type AgingBucket = '0-30 days' | '31-90 days' | '91-180 days' | '181-365 days' | '365+ days';

export interface InventoryValuationMethod {
  id: string;
  company_id: string;
  item_type: ItemType;
  item_id: string | null;
  valuation_method: ValuationMethod;
  is_default: boolean;
  effective_from: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface InventorySnapshot {
  id: string;
  company_id: string;
  snapshot_date: string;
  snapshot_type: SnapshotType;
  total_inventory_value: number;
  raw_materials_value: number;
  finished_goods_value: number;
  assets_value: number;
  item_count: number;
  snapshot_data: any;
  created_at: string;
  created_by: string | null;
}

export interface CostLayer {
  id: string;
  item_id: string;
  item_type: ItemType;
  transaction_id: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  total_cost: number;
  receipt_date: string;
  layer_status: 'active' | 'exhausted';
  company_id: string;
  created_at: string;
}

export interface ValuationReport {
  id: string;
  company_id: string;
  report_name: string;
  report_type: ReportType;
  filters: any;
  generated_at: string;
  generated_by: string | null;
  report_data: any;
  is_pinned: boolean;
}

export interface ItemValuation {
  item_id: string;
  item_code: string;
  item_name: string;
  item_type: ItemType;
  category: string;
  location: string;
  quantity_on_hand: number;
  unit_cost: number;
  total_value: number;
  valuation_method: ValuationMethod;
  days_in_stock: number;
  aging_bucket: AgingBucket;
  last_movement_date: string;
}

export interface ValuationSummary {
  total_inventory_value: number;
  raw_materials_value: number;
  finished_goods_value: number;
  assets_value: number;
  total_items: number;
  dead_stock_value: number;
  slow_moving_value: number;
  aging_breakdown: {
    [key in AgingBucket]: number;
  };
}

export interface ValuationFilters {
  valuationDate?: string;
  itemTypes?: ItemType[];
  categoryIds?: string[];
  locationIds?: string[];
  agingBucket?: AgingBucket;
}
