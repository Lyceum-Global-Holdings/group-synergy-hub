export type RfqRfpType = 'rfq' | 'rfp';
export type RfqRfpStatus = 'draft' | 'published' | 'in_progress' | 'evaluation' | 'awarded' | 'cancelled' | 'closed';
export type RfqRfpPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RfqRfpPublishType = 'public' | 'invited' | 'limited';
export type InvitationStatus = 'invited' | 'viewed' | 'declined' | 'submitted';
export type QuoteStatus = 'draft' | 'submitted' | 'under_evaluation' | 'shortlisted' | 'awarded' | 'rejected';
export type EvaluationRecommendation = 'strongly_recommend' | 'recommend' | 'neutral' | 'not_recommend' | 'reject';

export interface RfqRfpRequest {
  id: string;
  request_number: string;
  request_type: RfqRfpType;
  title: string;
  description?: string;
  category?: string;
  status: RfqRfpStatus;
  priority: RfqRfpPriority;
  pr_id?: string;
  bom_id?: string;
  issue_date: string;
  submission_deadline: string;
  evaluation_deadline?: string;
  budget_estimate?: number;
  currency: string;
  evaluation_criteria?: Record<string, any>;
  terms_and_conditions?: string;
  technical_specifications?: string;
  delivery_requirements?: string;
  payment_terms?: string;
  warranty_requirements?: string;
  compliance_requirements?: string;
  publish_type: RfqRfpPublishType;
  created_by?: string;
  approved_by?: string;
  approved_date?: string;
  awarded_supplier_id?: string;
  awarded_date?: string;
  company_id?: string;
  created_at: string;
  updated_at: string;
  items?: RfqRfpItem[];
  invited_suppliers?: RfqRfpInvitedSupplier[];
  quotes?: SupplierQuote[];
}

export interface RfqRfpItem {
  id?: string;
  request_id: string;
  line_number: number;
  warehouse_item_id?: string;
  item_code?: string;
  item_name: string;
  description?: string;
  specifications?: string;
  quantity: number;
  unit_of_measure: string;
  estimated_unit_price?: number;
  estimated_total_price?: number;
  delivery_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RfqRfpInvitedSupplier {
  id: string;
  request_id: string;
  supplier_id: string;
  invitation_date: string;
  invitation_status: InvitationStatus;
  invitation_notes?: string;
  viewed_at?: string;
  declined_reason?: string;
  created_at: string;
  supplier?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
}

export interface SupplierQuote {
  id: string;
  request_id: string;
  supplier_id: string;
  quote_number: string;
  submission_date: string;
  status: QuoteStatus;
  validity_period: number;
  total_quoted_amount: number;
  currency: string;
  payment_terms?: string;
  delivery_commitment?: string;
  warranty_offered?: string;
  notes?: string;
  attachments?: any[];
  evaluation_score?: number;
  evaluation_notes?: string;
  evaluated_by?: string;
  evaluated_at?: string;
  rejection_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: SupplierQuoteItem[];
  supplier?: {
    id: string;
    name: string;
    supplier_code?: string;
  };
}

export interface SupplierQuoteItem {
  id?: string;
  quote_id: string;
  rfq_item_id: string;
  line_number: number;
  unit_price: number;
  total_price: number;
  delivery_days?: number;
  alternative_offered?: boolean;
  alternative_description?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QuoteEvaluation {
  id: string;
  quote_id: string;
  evaluator_id: string;
  evaluation_date: string;
  criteria_scores?: Record<string, any>;
  technical_score?: number;
  commercial_score?: number;
  compliance_score?: number;
  overall_score?: number;
  strengths?: string;
  weaknesses?: string;
  recommendation?: EvaluationRecommendation;
  comments?: string;
  created_at: string;
}

export interface CreateRfqRfpData {
  request_type: RfqRfpType;
  title: string;
  description?: string;
  category?: string;
  priority: RfqRfpPriority;
  pr_id?: string;
  bom_id?: string;
  submission_deadline: string;
  evaluation_deadline?: string;
  budget_estimate?: number;
  currency?: string;
  evaluation_criteria?: Record<string, any>;
  terms_and_conditions?: string;
  technical_specifications?: string;
  delivery_requirements?: string;
  payment_terms?: string;
  warranty_requirements?: string;
  compliance_requirements?: string;
  publish_type: RfqRfpPublishType;
  company_id?: string;
  items: Omit<RfqRfpItem, 'id' | 'request_id' | 'created_at' | 'updated_at'>[];
  invited_supplier_ids?: string[];
}

export interface CreateQuoteData {
  request_id: string;
  supplier_id: string;
  validity_period?: number;
  payment_terms?: string;
  delivery_commitment?: string;
  warranty_offered?: string;
  notes?: string;
  attachments?: any[];
  items: Omit<SupplierQuoteItem, 'id' | 'quote_id' | 'created_at' | 'updated_at'>[];
}
