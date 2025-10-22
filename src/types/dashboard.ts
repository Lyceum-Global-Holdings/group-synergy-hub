export type WidgetType = 'kpi_card' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'gauge' | 'area_chart';
export type DashboardVisibility = 'private' | 'role_based' | 'company_wide';
export type PermissionLevel = 'view' | 'edit' | 'admin';

export interface Dashboard {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  layout_config: any; // Json type from Supabase
  is_default: boolean;
  visibility: DashboardVisibility;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  kpi_id: string | null;
  widget_type: WidgetType;
  title: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  config: any; // Json type from Supabase
  filter_config: any | null; // Json type from Supabase
  created_at: string;
  updated_at: string;
}

export interface WidgetConfig {
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  chartType?: string;
  threshold?: {
    warning?: number;
    danger?: number;
  };
  format?: string;
  decimals?: number;
}

export interface FilterConfig {
  dateRange?: {
    start: string;
    end: string;
  };
  companyId?: string;
  category?: string;
}

export interface DashboardPermission {
  id: string;
  dashboard_id: string;
  role_id: string | null;
  user_id: string | null;
  permission_level: PermissionLevel;
  created_at: string;
}
