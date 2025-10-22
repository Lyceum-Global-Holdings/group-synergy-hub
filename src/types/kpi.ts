export type KpiCategory = 'procurement' | 'warehouse' | 'finance' | 'sourcing' | 'custom';
export type CalculationType = 'count' | 'sum' | 'average' | 'percentage' | 'custom_sql';

export interface KpiDefinition {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  category: KpiCategory;
  data_source: string | null;
  calculation_type: CalculationType;
  sql_query: string | null;
  target_value: number | null;
  unit: string;
  refresh_interval: number;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KpiHistory {
  id: string;
  kpi_id: string;
  value: number;
  calculated_at: string;
  metadata: Record<string, any> | null;
}

export interface KpiValue {
  kpi: KpiDefinition;
  current_value: number;
  previous_value?: number;
  change_percentage?: number;
  trend?: 'up' | 'down' | 'stable';
  last_updated: string;
}
