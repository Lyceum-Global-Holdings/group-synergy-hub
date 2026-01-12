export interface WarehouseTool {
  id: string;
  tool_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  location_id: string | null;
  unit_id: string | null;
  total_quantity: number;
  available_quantity: number;
  issued_quantity: number;
  condition: string;
  unit_cost: number | null;
  image_url: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: {
    id: string;
    name: string;
  };
  location?: {
    id: string;
    name: string;
  };
  unit?: {
    id: string;
    name: string;
    abbreviation: string;
  };
}

export interface ToolIssue {
  id: string;
  issue_number: string;
  tool_id: string;
  issued_to: string | null;
  issued_to_name: string;
  department: string | null;
  issue_date: string;
  expected_return_date: string | null;
  expected_return_time: string | null;
  quantity_issued: number;
  quantity_returned: number;
  purpose: string | null;
  status: 'issued' | 'partially_returned' | 'returned' | 'overdue';
  notes: string | null;
  approved_by: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  tool?: WarehouseTool;
}

export interface ToolReturn {
  id: string;
  return_number: string;
  issue_id: string;
  return_date: string;
  quantity_returned: number;
  condition: 'good' | 'damaged' | 'lost' | 'needs_repair';
  condition_notes: string | null;
  returned_by_name: string | null;
  received_by: string | null;
  status: string;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  issue?: ToolIssue;
}

export interface CreateWarehouseToolData {
  tool_code: string;
  name: string;
  description?: string;
  category_id?: string;
  location_id?: string;
  unit_id?: string;
  total_quantity: number;
  condition?: string;
  unit_cost?: number;
  image_url?: string;
  notes?: string;
  company_id?: string;
}

export interface CreateToolIssueData {
  tool_id: string;
  issued_to?: string;
  issued_to_name: string;
  department?: string;
  issue_date: string;
  expected_return_date?: string;
  expected_return_time?: string;
  quantity_issued: number;
  purpose?: string;
  notes?: string;
  approved_by?: string;
  company_id?: string;
}

export interface CreateToolReturnData {
  issue_id: string;
  return_date: string;
  quantity_returned: number;
  condition: string;
  condition_notes?: string;
  returned_by_name?: string;
  notes?: string;
  company_id?: string;
}

export interface ToolAdjustment {
  id: string;
  tool_id: string;
  adjustment_type: "increase" | "decrease";
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
}
