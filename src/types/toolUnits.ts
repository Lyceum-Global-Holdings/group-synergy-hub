export type ToolUnitStatus =
  | 'in_service'
  | 'issued'
  | 'in_repair'
  | 'in_calibration'
  | 'retired'
  | 'lost';

export type ToolUnitCondition = 'new' | 'good' | 'fair' | 'needs_repair' | 'retired';

export type ToolUnitEventType =
  | 'registered'
  | 'issued'
  | 'returned'
  | 'condition_change'
  | 'calibration'
  | 'maintenance'
  | 'status_change'
  | 'retired'
  | 'lost';

export interface ToolUnit {
  id: string;
  tool_id: string;
  unit_code: string;
  serial_number?: string | null;
  asset_tag?: string | null;
  status: ToolUnitStatus;
  condition: ToolUnitCondition;
  location_id?: string | null;
  bin_id?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  warranty_expiry?: string | null;
  next_calibration_due?: string | null;
  next_maintenance_due?: string | null;
  notes?: string | null;
  company_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolUnitEvent {
  id: string;
  unit_id: string;
  event_type: ToolUnitEventType;
  event_date: string;
  from_value?: string | null;
  to_value?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface CreateToolUnitInput {
  tool_id: string;
  company_id?: string | null;
  serial_number?: string;
  asset_tag?: string;
  condition?: ToolUnitCondition;
  location_id?: string | null;
  bin_id?: string | null;
  purchase_date?: string;
  purchase_cost?: number;
  warranty_expiry?: string;
  notes?: string;
}

export const TOOL_UNIT_STATUS_LABELS: Record<ToolUnitStatus, string> = {
  in_service: 'In service',
  issued: 'Issued',
  in_repair: 'In repair',
  in_calibration: 'In calibration',
  retired: 'Retired',
  lost: 'Lost',
};

export const TOOL_UNIT_CONDITION_LABELS: Record<ToolUnitCondition, string> = {
  new: 'New',
  good: 'Good',
  fair: 'Fair',
  needs_repair: 'Needs repair',
  retired: 'Retired',
};

/** Whether a unit is available to issue. */
export const isToolUnitAvailable = (u: Pick<ToolUnit, 'status'>) => u.status === 'in_service';
