export type DemandSource = 'bom' | 'purchase_order' | 'forecast' | 'manual';
export type DemandStatus = 'calculated' | 'ordered' | 'fulfilled';
export type DemandPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface MaterialDemand {
  id: string;
  item_code: string;
  item_name: string;
  gross_requirement: number;
  current_stock: number;
  on_order_quantity: number;
  net_requirement: number;
  suggested_order_quantity: number;
  reorder_level: number;
  lead_time_days: number;
  safety_stock: number;
  demand_date: string;
  demand_source: DemandSource;
  reference_id?: string;
  status: DemandStatus;
  notes?: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialDemandItem {
  id: string;
  demand_id: string;
  bom_id?: string;
  bom_item_id?: string;
  po_id?: string;
  po_item_id?: string;
  warehouse_item_id?: string;
  quantity_required: number;
  unit_of_measure: string;
  unit_cost?: number;
  total_cost?: number;
  required_date: string;
  priority: DemandPriority;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialDemandData {
  item_code: string;
  item_name: string;
  gross_requirement: number;
  current_stock?: number;
  on_order_quantity?: number;
  reorder_level?: number;
  lead_time_days?: number;
  safety_stock?: number;
  demand_date: string;
  demand_source: DemandSource;
  reference_id?: string;
  notes?: string;
  company_id?: string;
}

export interface DemandCalculationInput {
  bom_id: string;
  production_quantity: number;
  production_date: string;
  include_safety_stock?: boolean;
}

export interface PODemandCalculationInput {
  po_ids: string[];
  multiplier?: number;
  analysis_date: string;
  include_safety_stock?: boolean;
}

export interface DemandAnalysisResult {
  item_code: string;
  item_name: string;
  total_required: number;
  available_stock: number;
  on_order: number;
  shortage: number;
  suggested_order: number;
  unit_of_measure: string;
  category?: string;
  priority: DemandPriority;
  lead_time_days: number;
  is_linked_to_bom?: boolean;
  bom_info?: {
    bom_number: string;
    product_name: string;
  };
  supplier_info?: {
    supplier_id: string;
    supplier_name: string;
    last_unit_cost?: number;
  };
  po_details?: {
    po_number: string;
    supplier_name: string;
    quantity_ordered: number;
    quantity_pending: number;
    delivery_date?: string;
    expected_delivery?: string;
  }[];
}

export interface MRPReport {
  analysis_date: string;
  production_requirements: {
    bom_id: string;
    product_name: string;
    quantity_required: number;
    production_date: string;
  }[];
  material_analysis: DemandAnalysisResult[];
  summary: {
    total_items_analyzed: number;
    items_in_shortage: number;
    items_requiring_orders: number;
    total_suggested_order_value: number;
  };
}