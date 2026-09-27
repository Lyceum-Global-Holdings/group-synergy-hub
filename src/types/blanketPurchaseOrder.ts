export type BlanketContractType = 'blanket_po' | 'contract_po' | 'framework_agreement';
export type BlanketContractStatus = 'draft' | 'active' | 'suspended' | 'expired' | 'closed' | 'cancelled';
export type BpoReleaseStatus = 'draft' | 'submitted' | 'approved' | 'sent' | 'received' | 'completed' | 'cancelled';
export type UrgencyLevel = 'normal' | 'urgent' | 'emergency';
export type AmendmentType = 'price_change' | 'quantity_change' | 'term_extension' | 'item_addition' | 'item_removal' | 'other';

export interface BlanketPurchaseOrder {
  id: string;
  bpo_number: string;
  contract_type: BlanketContractType;
  supplier_id: string;
  contract_start_date: string;
  contract_end_date: string;
  total_contract_value: number;
  remaining_value: number;
  contract_status: BlanketContractStatus;
  auto_renew: boolean;
  renewal_terms?: string;
  payment_terms?: string;
  delivery_terms?: string;
  currency: string;
  contract_terms?: string;
  early_termination_terms?: string;
  penalty_clauses?: any;
  approval_workflow_required: boolean;
  created_by?: string;
  approved_by?: string;
  approved_date?: string;
  company_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  supplier?: {
    name: string;
    email?: string;
    phone?: string;
  };
  items?: BlanketPoItem[];
  releases?: BlanketPoRelease[];
  amendments?: BlanketPoAmendment[];
}

export interface BlanketPoItem {
  id: string;
  bpo_id: string;
  warehouse_item_id?: string;
  item_name: string;
  item_code?: string;
  description?: string;
  specifications?: string;
  category?: string;
  unit_price: number;
  min_order_quantity?: number;
  max_order_quantity?: number;
  total_quantity_limit?: number;
  quantity_released: number;
  remaining_quantity?: number;
  unit_of_measure: string;
  lead_time_days: number;
  price_validity_start?: string;
  price_validity_end?: string;
  discount_percentage: number;
  discount_terms?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  warehouse_item?: {
    id: string;
    item_code: string;
    name: string;
  };
}

export interface BlanketPoRelease {
  id: string;
  release_number: string;
  bpo_id: string;
  release_date: string;
  requested_by?: string;
  release_status: BpoReleaseStatus;
  delivery_location?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  total_amount: number;
  approved_by?: string;
  approved_date?: string;
  urgency_level: UrgencyLevel;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: BlanketPoReleaseItem[];
  requested_by_profile?: {
    full_name?: string;
    email?: string;
  };
  approved_by_profile?: {
    full_name?: string;
    email?: string;
  };
  /** The purchase order created when the release was approved. */
  po_id?: string | null;
  po?: { id: string; po_number: string; status: string } | null;
  decision_notes?: string | null;
}

export interface BlanketPoReleaseItem {
  id: string;
  release_id: string;
  bpo_item_id: string;
  quantity_requested: number;
  quantity_approved?: number;
  quantity_received: number;
  unit_price: number;
  total_price: number;
  delivery_date?: string;
  delivery_location_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  bpo_item?: {
    item_name: string;
    item_code?: string;
    unit_of_measure: string;
  };
}

export interface BlanketPoAmendment {
  id: string;
  bpo_id: string;
  amendment_number: string;
  amendment_date: string;
  amendment_type: AmendmentType;
  previous_value?: any;
  new_value?: any;
  reason: string;
  approved_by?: string;
  approved_date?: string;
  created_by?: string;
  notes?: string;
  created_at: string;
  approver_profile?: {
    full_name?: string;
    email?: string;
  };
}

export interface BlanketPoSpendingAnalytics {
  id: string;
  bpo_id: string;
  analysis_period: string;
  period_start: string;
  period_end: string;
  total_releases: number;
  total_spent: number;
  total_quantity: number;
  average_lead_time?: number;
  utilization_percentage?: number;
  savings_achieved?: number;
  created_at: string;
}

export interface CreateBlanketPoData {
  contract_type: BlanketContractType;
  supplier_id: string;
  contract_start_date: string;
  contract_end_date: string;
  total_contract_value: number;
  auto_renew?: boolean;
  renewal_terms?: string;
  payment_terms?: string;
  delivery_terms?: string;
  currency?: string;
  contract_terms?: string;
  early_termination_terms?: string;
  penalty_clauses?: any;
  approval_workflow_required?: boolean;
  notes?: string;
  items: {
    warehouse_item_id?: string;
    item_name: string;
    item_code?: string;
    description?: string;
    specifications?: string;
    category?: string;
    unit_price: number;
    min_order_quantity?: number;
    max_order_quantity?: number;
    total_quantity_limit?: number;
    unit_of_measure: string;
    lead_time_days?: number;
    price_validity_start?: string;
    price_validity_end?: string;
    discount_percentage?: number;
    discount_terms?: string;
    notes?: string;
  }[];
}

export interface CreateBpoReleaseData {
  bpo_id: string;
  release_date?: string;
  delivery_location?: string;
  expected_delivery_date?: string;
  urgency_level?: UrgencyLevel;
  notes?: string;
  items: {
    bpo_item_id: string;
    quantity_requested: number;
    delivery_date?: string;
    delivery_location_id?: string;
    notes?: string;
  }[];
}

export interface CreateBpoAmendmentData {
  bpo_id: string;
  amendment_type: AmendmentType;
  previous_value?: any;
  new_value?: any;
  reason: string;
  notes?: string;
}

export interface BpoSummaryStats {
  total_bpos: number;
  active_bpos: number;
  draft_bpos: number;
  expiring_soon: number;
  total_value: number;
  total_spent: number;
  average_utilization: number;
}
