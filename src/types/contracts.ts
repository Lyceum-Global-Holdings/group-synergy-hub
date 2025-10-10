import { Database } from "@/integrations/supabase/types";

export type ContractType = Database['public']['Enums']['contract_type'];
export type ContractStatus = Database['public']['Enums']['contract_status'];
export type ContractPriority = Database['public']['Enums']['contract_priority'];
export type ContractRiskLevel = Database['public']['Enums']['contract_risk_level'];
export type ContractPartyType = Database['public']['Enums']['contract_party_type'];
export type ContractDocumentType = Database['public']['Enums']['contract_document_type'];
export type SignatureMethod = Database['public']['Enums']['signature_method'];
export type SignatureStatus = Database['public']['Enums']['signature_status'];
export type BillingFrequency = Database['public']['Enums']['billing_frequency'];
export type RenewalType = Database['public']['Enums']['renewal_type'];
export type ConfidentialityLevel = Database['public']['Enums']['confidentiality_level'];
export type ContractAmendmentType = Database['public']['Enums']['contract_amendment_type'];
export type ObligationType = Database['public']['Enums']['obligation_type'];
export type ObligationStatus = Database['public']['Enums']['obligation_status'];

export interface Contract {
  id: string;
  contract_number: string;
  contract_title: string;
  contract_type: ContractType;
  contract_category?: string;
  contract_sub_type?: string;
  status: ContractStatus;
  priority: ContractPriority;
  
  // Financial
  contract_value?: number;
  currency: string;
  payment_terms?: string;
  billing_frequency?: BillingFrequency;
  
  // Dates
  contract_date: string;
  effective_date: string;
  expiry_date?: string;
  notice_period_days?: number;
  renewal_notice_days: number;
  
  // Renewal
  auto_renew: boolean;
  renewal_type?: RenewalType;
  renewal_terms?: string;
  max_renewal_count?: number;
  renewal_count: number;
  
  // Parties
  primary_party_type?: string;
  primary_party_id?: string;
  counterparty_name?: string;
  counterparty_contact?: string;
  counterparty_email?: string;
  
  // Governance
  owner_id?: string;
  department_id?: string;
  cost_center_id?: string;
  approval_workflow_required: boolean;
  approved_by?: string;
  approved_date?: string;
  
  // Terms
  contract_terms?: string;
  special_conditions?: string;
  penalty_clauses?: any;
  termination_terms?: string;
  dispute_resolution?: string;
  governing_law?: string;
  
  // Risk
  risk_level: ContractRiskLevel;
  compliance_requirements?: any;
  insurance_required: boolean;
  insurance_details?: string;
  confidentiality_level: ConfidentialityLevel;
  
  // Metadata
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  signed_by_us?: string;
  signed_by_them?: string;
  signed_date?: string;
  notes?: string;
  tags?: any;
  
  // Relations
  parties?: ContractParty[];
  documents?: ContractDocument[];
  obligations?: ContractObligation[];
  amendments?: ContractAmendment[];
}

export interface ContractParty {
  id: string;
  contract_id: string;
  party_type: ContractPartyType;
  party_role?: string;
  party_reference_type?: string;
  party_reference_id?: string;
  party_name: string;
  party_contact_person?: string;
  party_email?: string;
  party_phone?: string;
  signing_authority?: string;
  signed: boolean;
  signed_date?: string;
  signature_method?: SignatureMethod;
  created_at: string;
}

export interface ContractDocument {
  id: string;
  contract_id: string;
  document_type: ContractDocumentType;
  document_name: string;
  file_path: string;
  file_url?: string;
  file_size?: number;
  mime_type?: string;
  version_number: string;
  is_latest_version: boolean;
  document_date?: string;
  uploaded_by?: string;
  uploaded_at: string;
  description?: string;
  is_signed: boolean;
  signature_status: SignatureStatus;
  esign_platform?: string;
  esign_reference_id?: string;
  notes?: string;
}

export interface ContractAmendment {
  id: string;
  contract_id: string;
  amendment_number: string;
  amendment_date: string;
  amendment_type: ContractAmendmentType;
  previous_value?: any;
  new_value?: any;
  reason: string;
  financial_impact?: number;
  approved_by?: string;
  approved_date?: string;
  effective_date?: string;
  created_by?: string;
  created_at: string;
  notes?: string;
  document_id?: string;
}

export interface ContractObligation {
  id: string;
  contract_id: string;
  obligation_type: ObligationType;
  title: string;
  description?: string;
  responsible_party?: string;
  assigned_to?: string;
  due_date?: string;
  completed: boolean;
  completed_date?: string;
  completed_by?: string;
  status: ObligationStatus;
  priority: ContractPriority;
  value_amount?: number;
  currency: string;
  penalty_for_delay?: number;
  evidence_required: boolean;
  evidence_notes?: string;
  recurrence?: string;
  next_occurrence_date?: string;
  notification_days_before?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateContractData {
  contract_title: string;
  contract_type: ContractType;
  contract_category?: string;
  contract_sub_type?: string;
  priority?: ContractPriority;
  
  // Financial
  contract_value?: number;
  currency?: string;
  payment_terms?: string;
  billing_frequency?: BillingFrequency;
  
  // Dates
  contract_date?: string;
  effective_date: string;
  expiry_date?: string;
  notice_period_days?: number;
  renewal_notice_days?: number;
  
  // Renewal
  auto_renew?: boolean;
  renewal_type?: RenewalType;
  renewal_terms?: string;
  max_renewal_count?: number;
  
  // Parties
  primary_party_type?: string;
  primary_party_id?: string;
  counterparty_name?: string;
  counterparty_contact?: string;
  counterparty_email?: string;
  
  // Governance
  owner_id?: string;
  department_id?: string;
  cost_center_id?: string;
  approval_workflow_required?: boolean;
  
  // Terms
  contract_terms?: string;
  special_conditions?: string;
  penalty_clauses?: any;
  termination_terms?: string;
  dispute_resolution?: string;
  governing_law?: string;
  
  // Risk
  risk_level?: ContractRiskLevel;
  compliance_requirements?: any;
  insurance_required?: boolean;
  insurance_details?: string;
  confidentiality_level?: ConfidentialityLevel;
  
  // Metadata
  notes?: string;
  tags?: any;
}
